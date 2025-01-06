const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 8080;

// Configuration AWS S3 (remplacez par vos propres informations Clever Cloud)
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_access, // Votre clé d'accès Clever Cloud
  secretAccessKey: process.env.S3_secret, // Votre clé secrète Clever Cloud
  endpoint: process.env.S3_end, // L'URL de l'endpoint Clever Cloud
  s3ForcePathStyle: true, // Nécessaire pour certains services compatibles S3
});
const BUCKET_NAME = "JULES_AIME_PAS_STARWARS"; // Le nom de votre bucket

// Middleware pour parser les requêtes JSON
app.use(bodyParser.json());
app.use("/", express.static(path.join(__dirname, "public")));

// Générer un nouvel ID unique
const generateId = () => {
  return Date.now();
};

// Vérifier si le bucket existe, sinon le créer
const ensureBucketExists = async () => {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`Bucket ${BUCKET_NAME} already exists.`);
  } catch (error) {
    if (error.statusCode === 404) {
      console.log(`Bucket ${BUCKET_NAME} does not exist. Creating it...`);
      await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(`Bucket ${BUCKET_NAME} created successfully.`);
    } else {
      throw error;
    }
  }
};

// Fonction pour créer un fichier .txt et l'envoyer au bucket
const uploadToBucket = async (fileName, content) => {
  const filePath = path.join(__dirname, fileName);

  // Vérifier et créer le bucket si nécessaire
  await ensureBucketExists();

  // Écrire le contenu dans un fichier local
  fs.writeFileSync(filePath, content);

  // Lire le fichier pour l'envoyer à S3
  const fileContent = fs.readFileSync(filePath);

  // Paramètres pour l'envoi au bucket
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: "text/plain",
  };

  // Envoi au bucket
  await s3.upload(params).promise();

  // Supprimer le fichier local après l'envoi
  fs.unlinkSync(filePath);
};

// Fonction pour récupérer tous les fichiers du bucket
const listBucketItems = async () => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
    };
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents.map((item) => item.Key);
  } catch (error) {
    console.error("Error listing bucket items:", error);
    throw new Error("Failed to list bucket items");
  }
};

const getBucketItemContent = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key, // La bonne syntaxe
    };
    const data = await s3.getObject(params).promise(); // Utiliser getObject pour obtenir l'objet
    return data.Body.toString("utf-8"); // Convertir en texte et retourner le contenu
  } catch (error) {
    console.error("Error getting file content:", error);
    throw new Error("Failed to get file content");
  }
};

// Routes CRUD

// CREATE - Ajouter un nouvel item et envoyer un fichier au bucket
app.post("/api/items", async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required" });
  }
  const id = generateId();
  const newItem = { id, name, description };

  // Générer le contenu du fichier .txt
  const fileContent = `ID: ${id}\nName: ${name}\nDescription: ${description}`;
  const fileName = `item-${id}.txt`;

  try {
    await uploadToBucket(fileName, fileContent);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file to bucket" });
  }
});

// READ - Récupérer tous les items
app.get("/api/items", async (req, res) => {
  try {
    const items = await listBucketItems();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve items from bucket" });
  }
});

// READ - Récupérer le contenu d'un fichier
app.get("/api/items/:fileName", async (req, res) => {
  const { fileName } = req.params;
  try {
    const content = await getBucketItemContent(fileName); // Appel de la fonction corrigée pour récupérer le contenu
    res.json({ content }); // Retourne le contenu au client
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve file content" });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Création d'une interface utilisateur dans /public/index.html
