const express = require("express");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
} = require("@aws-sdk/client-s3");
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 8080;
const BUCKET_NAME = "deded_JULES_AIME_PAS_STARWARS";

// S3 Configuration
const endpoint = process.env.S3_end;
const accessKeyId = process.env.S3_access;
const secretAccessKey = process.env.S3_secret;

const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// MySQL Configuration
const MYSQL_URI = process.env.MYSQL_ADDON_URI;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// POST: Upload an image
app.post("/upload", upload.single("image"), async (req, res) => {
  const { tags } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filename = `${Date.now()}-${file.originalname}`;

  try {
    // Upload file to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    // Store metadata in MySQL
    const connection = await mysql.createConnection(MYSQL_URI);
    if (tags && tags.length) {
      const tagArray = tags.split(",");
      for (const tag of tagArray) {
        await connection.query(
          "INSERT INTO files (tag, filename) VALUES (?, ?)",
          [tag.trim(), filename]
        );
      }
    }
    await connection.end();

    res.status(201).json({ message: "File uploaded successfully", filename });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ error: "Failed to upload file." });
  }
});

// GET: Retrieve all uploaded images
app.get("/images", async (req, res) => {
  try {
    const connection = await mysql.createConnection(MYSQL_URI);
    const [rows] = await connection.query(
      "SELECT filename, tag, created_at FROM files"
    );
    await connection.end();

    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching images:", err);
    res.status(500).json({ error: "Failed to fetch images." });
  }
});

// GET: Retrieve a single image
app.get("/images/:filename", async (req, res) => {
  const { filename } = req.params;

  try {
    const data = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: filename })
    );

    res.setHeader("Content-Type", data.ContentType);
    data.Body.pipe(res);
  } catch (err) {
    console.error("Error retrieving image:", err);
    res.status(500).json({ error: "Failed to retrieve image." });
  }
});

// DELETE: Delete an image
app.delete("/images/:filename", async (req, res) => {
  const { filename } = req.params;
  ç;
  try {
    // Delete from S3
    await s3.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: filename })
    );

    // Delete metadata from MySQL
    const connection = await mysql.createConnection(MYSQL_URI);
    await connection.query("DELETE FROM files WHERE filename = ?", [filename]);
    await connection.end();

    res.status(200).json({ message: "Image deleted successfully." });
  } catch (err) {
    console.error("Error deleting image:", err);
    res.status(500).json({ error: "Failed to delete image." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
