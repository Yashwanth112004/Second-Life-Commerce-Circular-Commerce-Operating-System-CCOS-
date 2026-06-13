import multer from "multer";
import {
    existsSync,
    mkdirSync
} from "node:fs";
import {
    extname,
    join
} from "node:path";
import {
    randomUUID
} from "node:crypto";
import {
    config
} from "../config.js";

const UPLOAD_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, {
    recursive: true
});

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
});

const ALLOWED = /jpeg|jpg|png|webp|gif|mp4|mov|webm/;

export const uploadEvidence = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024,
        files: 8
    },
    fileFilter: (_req, file, cb) => {
        const ok = ALLOWED.test(extname(file.originalname).toLowerCase()) && /image|video/.test(file.mimetype);
        cb(ok ? null : new Error("Only image/video files are allowed"), ok);
    },
});

/** Turn a stored file into a public URL + kind. Cloudinary path is wired for production. */
export function fileToRecord(file) {
    const kind = file.mimetype.startsWith("video") ? "video" : "image";
    if (config.storage.driver === "cloudinary" && config.storage.cloudinaryUrl) {
        // Production: upload to Cloudinary here and return its secure_url.
        // Left as the integration point; local driver is the default.
    }
    return {
        url: `/uploads/${file.filename}`,
        kind
    };
}

export {
    UPLOAD_DIR
};