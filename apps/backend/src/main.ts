import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Verify this import matches your specific pdf-parse library wrapper
import { PDFParse } from "pdf-parse";

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pdfPath = path.join(__dirname, "../../../attachments/module-1.pdf");
  const parser = new PDFParse({ url: pdfPath });
  console.log(path.parse(pdfPath));
  console.log(await fs.lstat(pdfPath));
  return;

  const result = await parser.getText();
  const image = await parser.getImage();

  // Create an output directory path
  const outputDir = path.join(process.cwd(), "extracted-data");

  // Ensure the directory exists before writing to it
  await fs.mkdir(outputDir, { recursive: true });

  // Structure the data you want to save
  const structuredOutput = {
    extractedText: result,
    imageMetadata: image,
  };

  // Define the target JSON file path
  const jsonFilePath = path.join(outputDir, "parsed-output.json");

  // Write the structured object to the JSON file
  await fs.writeFile(
    jsonFilePath,
    JSON.stringify(structuredOutput, null, 2),
    "utf-8",
  );

  console.log(`Successfully saved structured data to ${jsonFilePath}`);
}

main().catch(console.error);
