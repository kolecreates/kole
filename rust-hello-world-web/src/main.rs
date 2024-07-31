use actix_web::{get, App, HttpResponse, HttpServer, Responder};

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().content_type("text/html").body(
        r#"
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Hello, World!</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .container {
                        background-color: #ffffff;
                        border-radius: 10px;
                        padding: 2rem;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    h1 {
                        color: #333;
                        font-size: 3rem;
                        margin-bottom: 1rem;
                    }
                    p {
                        color: #666;
                        font-size: 1.2rem;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Hello, World!</h1>
                </div>
            </body>
        </html>
        "#,
    )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting server at http://127.0.0.1:3000");
    HttpServer::new(|| App::new().service(hello))
        .bind(("127.0.0.1", 3000))?
        .run()
        .await
}