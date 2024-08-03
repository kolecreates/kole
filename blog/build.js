import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processFiles(directory, buildDir, transformations) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processFiles(filePath, buildDir, transformations);
    } else {
      const fileExtension = path.extname(file).toLowerCase();
      const applicableTransformations = transformations.filter((t) =>
        t.extensions.includes(fileExtension)
      );
      if (applicableTransformations.length > 0) {
        processFile(filePath, buildDir, applicableTransformations);
      }
    }
  }
}

function processFile(filePath, buildDir, transformations) {
  let content = fs.readFileSync(filePath, "utf8");

  for (const transformation of transformations) {
    content = transformation.process(content, filePath);
  }

  const relativePath = path.relative(path.join(__dirname, "public"), filePath);
  const outputPath = path.join(buildDir, relativePath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
}

const importTransformation = {
  extensions: [".html"],
  process: (content, filePath) => {
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

    return content;
  },
};

const layoutTransformation = {
  extensions: [".html"],
  process: (content, filePath) => {
    const layoutRegex = /<!--\s*@layout\s+'([^']+)'\s*(\{[^}]+\})?\s*-->/;
    const match = content.match(layoutRegex);

    if (match) {
      const layoutPath = match[1];
      let layoutOptions = {};
      if (match[2]) {
        layoutOptions = JSON.parse(match[2].trim());
      }
      const templatePath = path.join(__dirname, "templates", layoutPath);

      if (fs.existsSync(templatePath)) {
        let layoutContent = fs.readFileSync(templatePath, "utf8");

        // Process imports in the layout file
        layoutContent = importTransformation.process(
          layoutContent,
          templatePath
        );

        // Replace all {{ param }} placeholders with the provided values
        for (const [key, value] of Object.entries(layoutOptions)) {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
          layoutContent = layoutContent.replace(regex, value);
        }

        // Replace <!-- @slot --> with the content
        content = content.replace(match[0], ""); // Remove the @layout comment
        layoutContent = layoutContent.replace(
          /<!--\s*@slot\s*-->/g,
          content.trim()
        );

        return layoutContent;
      } else {
        console.warn(`Layout file not found: ${templatePath}`);
      }
    }

    return content;
  },
};

function copyNonHtmlFiles(directory, buildDir) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (!stat.isDirectory() && !file.endsWith(".html")) {
      fs.copyFileSync(filePath, path.join(buildDir, file));
    }
  }
}

const transformations = [importTransformation, layoutTransformation];
const publicDir = path.join(__dirname, "public");
const buildDir = path.join(__dirname, "build");
processFiles(publicDir, buildDir, transformations);
copyNonHtmlFiles(publicDir, buildDir);

console.log("Build completed successfully.");
