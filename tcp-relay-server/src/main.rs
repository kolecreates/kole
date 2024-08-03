use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

const MAX_CONNECTIONS: usize = 10; // Adjust this value as needed
const MAX_MESSAGE_SIZE: usize = 1024;
const MAX_THREADS: usize = 1; // @TODO auto detect based on cpu count
const CONNECTIONS_PER_THREAD: usize = MAX_CONNECTIONS / MAX_THREADS;

const EMPTY_CONNECTION_SLOT: Option<TcpStream> = None;
const EMPTY_THREAD_HANDLE: Option<thread::JoinHandle<()>> = None;

struct ThreadSharedState {
    connection_queue: [Option<TcpStream>; MAX_CONNECTIONS],
    connection_counter: usize,
    terminated: bool,
}

struct ThreadInternalState {
    shared_state_ref: Arc<Mutex<ThreadSharedState>>,
    connections: [Option<TcpStream>; CONNECTIONS_PER_THREAD],
    connection_counter: usize,
    connection_drop_count: usize,
    message_buffer: [u8; MAX_MESSAGE_SIZE],
}

trait AcceptConnections {
    fn accept_connections(&mut self) -> Result<(), std::io::Error>;
}

trait BroadcastMessages {
    fn broadcast_messages(&mut self);
}

impl AcceptConnections for ThreadInternalState {
    fn accept_connections(&mut self) -> Result<(), std::io::Error> {
        if self.connection_counter < CONNECTIONS_PER_THREAD {
            match self.shared_state_ref.try_lock() {
                Ok(mut shared_state) => {
                    if shared_state.terminated {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "Server terminated",
                        ));
                    }
                    shared_state.connection_counter -= self.connection_drop_count;
                    self.connection_drop_count = 0;
                    for i in 0..shared_state.connection_queue.len() {
                        if self.connection_counter < CONNECTIONS_PER_THREAD {
                            if let Some(stream) = shared_state.connection_queue[i].take() {
                                self.connections[self.connection_counter] = Some(stream);
                                self.connection_counter += 1;
                                shared_state.connection_counter += 1;
                            }
                        }
                    }
                    return Ok(());
                }
                Err(_) => {
                    // couldn't get lock, try again next iteration
                    return Ok(());
                }
            };
        } else {
            return Ok(());
        }
    }
}

impl BroadcastMessages for ThreadInternalState {
    fn broadcast_messages(&mut self) {
        for i in 0..self.connections.len() {
            let connection_slot = &mut self.connections[i];
            if let Some(stream) = connection_slot {
                match stream.read(&mut self.message_buffer) {
                    Ok(0) => {
                        // disconnect the client
                        connection_slot.take();
                        self.connection_counter -= 1;
                        self.connection_drop_count += 1;
                    }
                    Ok(bytes_read) => {
                        for k in 0..self.connections.len() {
                            if k == i {
                                continue;
                            }
                            let other_connection_slot = &mut self.connections[k];
                            if let Some(other_stream) = other_connection_slot {
                                if let Err(_) =
                                    other_stream.write_all(&self.message_buffer[..bytes_read])
                                {
                                    // Failed to write, shutdown the stream
                                    if let Err(_) = other_stream.shutdown(std::net::Shutdown::Both)
                                    {
                                        // If shutdown fails, just continue and remove the connection
                                    }
                                    other_connection_slot.take();
                                    self.connection_counter -= 1;
                                    self.connection_drop_count += 1;
                                }
                            }
                        }
                    }
                    Err(_) => {
                        // disconnect the client
                        match stream.shutdown(std::net::Shutdown::Both) {
                            _default => {
                                // remove in any case
                                connection_slot.take();
                                self.connection_counter -= 1;
                                self.connection_drop_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }
}

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080")?;
    listener.set_nonblocking(true)?;
    println!("Server listening on 127.0.0.1:8080");

    let mut thread_handles: [Option<thread::JoinHandle<()>>; MAX_THREADS] =
        [EMPTY_THREAD_HANDLE; MAX_THREADS];
    let mut thread_counter = 0;

    let shared_state_ref = Arc::new(Mutex::new(ThreadSharedState {
        connection_queue: [EMPTY_CONNECTION_SLOT; MAX_CONNECTIONS],
        connection_counter: 0,
        terminated: false,
    }));

    // spawn threads
    for _ in 0..MAX_THREADS {
        let thread_builder: thread::Builder = thread::Builder::new();
        let shared_state_ref_clone = shared_state_ref.clone();
        let thread_handle = thread_builder
            .spawn(move || {
                let mut thread_state = ThreadInternalState {
                    shared_state_ref: shared_state_ref_clone,
                    connections: [EMPTY_CONNECTION_SLOT; CONNECTIONS_PER_THREAD],
                    connection_counter: 0,
                    connection_drop_count: 0,
                    message_buffer: [0; MAX_MESSAGE_SIZE],
                };

                loop {
                    if let Err(_) = thread_state.accept_connections() {
                        break;
                    }
                    thread_state.broadcast_messages();
                }

                // close all connections
                for i in 0..thread_state.connections.len() {
                    if let Some(stream) = &thread_state.connections[i] {
                        if let Err(_) = stream.shutdown(std::net::Shutdown::Both) {
                            // ignore error
                        }
                    }
                }
                println!("Thread {} terminated", thread_counter);
            })
            .expect("Failed to spawn thread");
        thread_handles[thread_counter] = Some(thread_handle);
        thread_counter += 1;
    }

    let ctrlc_signal_handler_shared_state_ref = shared_state_ref.clone();
    ctrlc::set_handler(move || {
        let mut shared_state = ctrlc_signal_handler_shared_state_ref
            .lock()
            .expect("Ctrlc signal handler failed to lock shared state");
        shared_state.terminated = true;
    })
    .expect("Error setting Ctrl-C handler");

    loop {
        match shared_state_ref.try_lock() {
            Ok(shared_state) => {
                if shared_state.terminated {
                    break;
                }
            }
            Err(_) => {
                // couldn't get lock, try again next iteration
            }
        }

        match listener.accept() {
            Ok((stream, _)) => {
                let mut shared_state = shared_state_ref.lock().expect("Failed to lock relay state");
                if shared_state.terminated {
                    break;
                }
                stream
                    .set_nonblocking(true)
                    .expect("Failed to set nonblocking");

                let mut connection_index = None;
                if shared_state.connection_counter < MAX_CONNECTIONS {
                    // look for empty slot
                    for i in 0..MAX_CONNECTIONS {
                        if shared_state.connection_queue[i].is_none() {
                            connection_index = Some(i);
                            break;
                        }
                    }
                }

                if let Some(index) = connection_index {
                    shared_state.connection_queue[index] = Some(stream);
                    shared_state.connection_counter += 1;
                } else {
                    // disconnect the client
                    if let Err(_) = stream.shutdown(std::net::Shutdown::Both) {
                        // ignore error
                    }
                }
            }
            Err(ref e) if e.kind() == ErrorKind::WouldBlock => {}
            Err(e) => {
                println!("Error accepting connection: {}", e);
                break;
            }
        };
    }

    // wait for all threads to terminate
    for i in 0..MAX_THREADS {
        let handle = thread_handles[i].take();
        if let Some(thread_handle) = handle {
            thread_handle.join().expect("Failed to join thread.");
            println!("Thread {} terminated", i);
        }
    }

    Ok(())
}
