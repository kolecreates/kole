import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processHtmlFiles(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processHtmlFiles(filePath);
    } else if (path.extname(file).toLowerCase() === ".html") {
      processFile(filePath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const regex = /<!--\s*@import\s+'([^']+)'\s*-->/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1];
    const templatePath = path.join(__dirname, "templates", importPath);

    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, "utf8");
      content = content.replace(match[0], templateContent);
    } else {
      console.warn(`Template file not found: ${templatePath}`);
    }
  }

  const buildDir = path.join(__dirname, "build");
  const relativePath = path.relative(path.join(__dirname, "public"), filePath);
  const outputPath = path.join(buildDir, relativePath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
}

const publicDir = path.join(__dirname, "public");
processHtmlFiles(publicDir);

console.log("Build completed successfully.");
