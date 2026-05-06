require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const axios = require("axios");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "medsense_secret_key";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const DEFAULT_CORS_ORIGINS = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://mymedsense.co",
  "https://www.mymedsense.co",
];
const CORS_ORIGINS = (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || "254";
const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const PASSWORD_SALT_ROUNDS = Number(process.env.PASSWORD_SALT_ROUNDS || 12);
const MONGODB_URI =
  process.env.MONGODB_URI ||
  (String(process.env.DATABASE_URL || "").startsWith("mongodb")
    ? process.env.DATABASE_URL
    : "");
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "medsense";

let dbStatus = {
  connected: false,
  lastError: null,
};
let dbPromise = null;
let adminSeeded = false;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, index: true },
    password: String,
    role: { type: String, default: "patient" },
    age: Number,
    gender: String,
    phone: String,
    condition_summary: String,
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const medicineSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    name: String,
    condition_name: String,
    dosage: String,
    time: String,
    frequency: String,
    route: String,
    instructions: String,
    status: { type: String, default: "pending" },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const reviewSchema = new mongoose.Schema(
  {
    medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", index: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    problem: String,
    intervention: String,
    treatment_stage: String,
    notes: String,
    problem_category: String,
    problem_cause: String,
    intervention_done: String,
    details: String,
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const checkinSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    feeling: String,
    symptoms: String,
    pills: String,
    answers_json: String,
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const activitySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: String,
    details: String,
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Medicine = mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema);
const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
const Checkin = mongoose.models.Checkin || mongoose.model("Checkin", checkinSchema);
const Activity = mongoose.models.Activity || mongoose.model("Activity", activitySchema);

function docId(doc) {
  if (!doc) return "";
  if (doc._id) return String(doc._id);
  if (typeof doc.toHexString === "function") return doc.toHexString();
  if (doc.id && typeof doc.id !== "object") return String(doc.id);
  return String(doc);
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), PASSWORD_SALT_ROUNDS);
}

function isPasswordHash(password) {
  return /^\$2[aby]\$\d{2}\$/.test(String(password || ""));
}

function passwordMatches(inputPassword, storedPassword) {
  if (!storedPassword) return false;

  if (isPasswordHash(storedPassword)) {
    return bcrypt.compareSync(String(inputPassword), storedPassword);
  }

  return String(inputPassword).trim() === String(storedPassword).trim();
}

async function connectDb() {
  if (!MONGODB_URI) {
    dbStatus = {
      connected: false,
      lastError: "MONGODB_URI is not configured",
    };
    throw new Error(dbStatus.lastError);
  }

  if (mongoose.connection.readyState === 1) {
    dbStatus = { connected: true, lastError: null };
    if (!adminSeeded) await seedAdminUser();
    return;
  }

  if (!dbPromise) {
    dbPromise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB_NAME,
        serverSelectionTimeoutMS: 10000,
      })
      .then(async () => {
        dbStatus = { connected: true, lastError: null };
        await seedAdminUser();
      })
      .catch((err) => {
        dbPromise = null;
        dbStatus = {
          connected: false,
          lastError: err.code || err.message,
        };
        throw err;
      });
  }

  await dbPromise;
}

async function ensureDb(req, res, next) {
  try {
    await connectDb();
    next();
  } catch (err) {
    console.log("MongoDB connection error:", err.code || err.message);
    res.status(500).json({ message: "Database is not connected" });
  }
}

async function seedAdminUser() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!adminEmail || !adminPassword) {
    adminSeeded = true;
    console.log("Admin seed skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not configured");
    return;
  }

  const adminName = String(process.env.ADMIN_NAME || "MedSense Admin").trim();
  const adminPhone = String(process.env.ADMIN_PHONE || "").trim() || null;

  await User.updateOne(
    { email: adminEmail },
    {
      $set: {
        name: adminName,
        email: adminEmail,
        password: hashPassword(adminPassword),
        role: "admin",
        phone: adminPhone,
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    },
    { upsert: true }
  );

  adminSeeded = true;
  console.log(`Admin user ready: ${adminEmail}`);
}

function userView(user) {
  if (!user) return null;

  return {
    id: docId(user),
    name: user.name,
    email: user.email,
    role: user.role,
    age: user.age,
    gender: user.gender,
    phone: user.phone,
    condition_summary: user.condition_summary,
    created_at: user.created_at,
  };
}

function medicineView(medicine, patient) {
  if (!medicine) return null;

  return {
    id: docId(medicine),
    user_id: docId(medicine.user_id),
    name: medicine.name,
    condition_name: medicine.condition_name,
    dosage: medicine.dosage,
    time: medicine.time,
    frequency: medicine.frequency,
    route: medicine.route,
    instructions: medicine.instructions,
    status: medicine.status,
    created_at: medicine.created_at,
    patient_name: patient?.name,
    patient_email: patient?.email,
    patient_phone: patient?.phone,
    patient_age: patient?.age,
    patient_gender: patient?.gender,
    condition_summary: patient?.condition_summary,
  };
}

function reviewView(review, medicine, admin) {
  if (!review) return null;

  return {
    id: docId(review),
    medicine_id: docId(review.medicine_id),
    patient_id: docId(review.patient_id),
    admin_id: docId(review.admin_id),
    problem: review.problem,
    intervention: review.intervention,
    treatment_stage: review.treatment_stage,
    notes: review.notes,
    problem_category: review.problem_category,
    problem_cause: review.problem_cause,
    intervention_done: review.intervention_done,
    details: review.details,
    created_at: review.created_at,
    medicine_name: medicine?.name,
    dosage: medicine?.dosage,
    time: medicine?.time,
    pharmacist_name: admin?.name,
  };
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(403).json({ message: "No token" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });

    req.user = decoded;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();

    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

async function logActivity(userId, action, details) {
  try {
    await Activity.create({ user_id: userId, action, details });
  } catch (err) {
    console.log("Activity log error:", err.message);
  }
}

function cleanDashboardUrl() {
  return `${CLIENT_URL.replace(/\/+$/, "")}/?open=dashboard`;
}

function normalizeWhatsappNumber(phone) {
  if (!phone) return "";

  let digits = String(phone).replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let emailTransporter = null;

function getEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  if (!emailTransporter) {
    const port = Number(process.env.EMAIL_PORT || 465);

    emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port,
      secure: String(process.env.EMAIL_SECURE || "true") !== "false",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return emailTransporter;
}

function buildReviewNotification(patient, reviewData) {
  const dashboardUrl = cleanDashboardUrl();
  const patientName = patient.patient_name || "there";
  const medicineName = patient.medicine_name || "your medicine";
  const intervention = reviewData.intervention_done || "Review updated";
  const treatmentStage = reviewData.treatment_stage || "Started";
  const problem = reviewData.problem_category || "Medication review";

  const textLines = [
    `Hi ${patientName},`,
    `Your MedSense pharmacist review for ${medicineName} is ready.`,
    `Problem: ${problem}`,
    `Intervention: ${intervention}`,
    `Treatment stage: ${treatmentStage}`,
    `Open your patient dashboard: ${dashboardUrl}`,
  ];

  if (reviewData.details) {
    textLines.splice(5, 0, `Details: ${reviewData.details}`);
  }

  const text = textLines.join("\n");

  return {
    patientName,
    medicineName,
    dashboardUrl,
    subject: `MedSense review ready for ${medicineName}`,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">Your MedSense review is ready</h2>
        <p>Hi ${escapeHtml(patientName)},</p>
        <p>Your pharmacist review for <strong>${escapeHtml(medicineName)}</strong> is ready.</p>
        <p><strong>Problem:</strong> ${escapeHtml(problem)}</p>
        <p><strong>Intervention:</strong> ${escapeHtml(intervention)}</p>
        <p><strong>Treatment stage:</strong> ${escapeHtml(treatmentStage)}</p>
        ${
          reviewData.details
            ? `<p><strong>Details:</strong> ${escapeHtml(reviewData.details)}</p>`
            : ""
        }
        <p>
          <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background: #00d4aa; color: #0a0f1e; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: 700;">
            Open patient dashboard
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px;">If the button does not work, open this link: ${escapeHtml(dashboardUrl)}</p>
      </div>
    `,
  };
}

async function sendReviewEmail(patient, notification) {
  if (!patient.patient_email) {
    console.log("Email notification skipped: patient email is missing");
    return;
  }

  const transporter = getEmailTransporter();

  if (!transporter) {
    console.log("Email notification skipped: EMAIL_USER and EMAIL_PASS are not configured");
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `MedSense <${process.env.EMAIL_USER}>`,
    to: patient.patient_email,
    subject: notification.subject,
    text: notification.text,
    html: notification.html,
  });
}

function buildWhatsappPayload(to, notification) {
  if (process.env.WHATSAPP_TEMPLATE_NAME) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: {
          code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: notification.patientName },
              { type: "text", text: notification.medicineName },
              { type: "text", text: notification.dashboardUrl },
            ],
          },
        ],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: true,
      body: notification.text,
    },
  };
}

async function sendReviewWhatsapp(patient, notification) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log("WhatsApp notification skipped: WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not configured");
    return;
  }

  const to = normalizeWhatsappNumber(patient.patient_phone);

  if (!to) {
    console.log("WhatsApp notification skipped: patient phone is missing");
    return;
  }

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await axios.post(url, buildWhatsappPayload(to, notification), {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

async function notifyPatientReview(reviewData) {
  const [patient, medicine] = await Promise.all([
    User.findById(reviewData.patient_id).lean(),
    Medicine.findById(reviewData.medicine_id).lean(),
  ]);

  if (!patient) {
    console.log("Notification skipped: patient was not found");
    return;
  }

  const notificationPatient = {
    patient_name: patient.name,
    patient_email: patient.email,
    patient_phone: patient.phone,
    medicine_name: medicine?.name,
    dosage: medicine?.dosage,
    time: medicine?.time,
  };
  const notification = buildReviewNotification(notificationPatient, reviewData);

  await Promise.allSettled([
    sendReviewEmail(notificationPatient, notification),
    sendReviewWhatsapp(notificationPatient, notification),
  ]);
}

app.get("/", (req, res) => {
  res.send("MedSense backend working");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "medsense-backend",
    database: dbStatus.connected ? "connected" : "disconnected",
  });
});

app.get("/health/db", async (req, res) => {
  try {
    await connectDb();
    await mongoose.connection.db.admin().ping();
    res.json({
      status: "ok",
      service: "medsense-backend",
      database: "connected",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      service: "medsense-backend",
      database: "disconnected",
    });
  }
});

app.get("/me", ensureDb, verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(userView(user));
  } catch (err) {
    console.log("ME ERROR:", err.message);
    res.status(500).json({ message: "Could not load user" });
  }
});

app.post("/register", ensureDb, async (req, res) => {
  const { name, email, password, age, gender, phone } = req.body;

  if (!name || !email || !password || !age || !phone) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    await User.create({
      name,
      email: String(email).trim().toLowerCase(),
      password: hashPassword(password),
      role: "patient",
      age: Number(age),
      gender: gender || null,
      phone,
    });

    res.json({ message: "Patient registered successfully" });
  } catch (err) {
    console.log("REGISTER ERROR:", err.code || err.message);
    res.status(400).json({ message: "Email already exists" });
  }
});

app.post("/login", ensureDb, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: String(email || "").trim().toLowerCase() });

    if (!user || !passwordMatches(password, user.password)) {
      return res.status(401).json({ message: "Invalid login" });
    }

    if (!isPasswordHash(user.password)) {
      user.password = hashPassword(password);
      await user.save();
    }

    const token = jwt.sign(
      { id: docId(user), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: userView(user),
    });
  } catch (err) {
    console.log("LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/medicines", ensureDb, verifyToken, async (req, res) => {
  const { name, condition_name, dosage, time, frequency, route, instructions } = req.body;

  if (!name || !dosage || !time) {
    return res.status(400).json({ message: "All medicine fields required" });
  }

  try {
    const medicine = await Medicine.create({
      user_id: req.user.id,
      name,
      condition_name: condition_name || null,
      dosage,
      time,
      frequency: frequency || null,
      route: route || null,
      instructions: instructions || null,
    });

    if (condition_name) {
      await User.updateOne(
        { _id: req.user.id },
        { $set: { condition_summary: condition_name } }
      );
    }

    res.json({ message: "Medicine added successfully", id: docId(medicine) });
  } catch (err) {
    console.log("Add medicine error:", err.message);
    res.status(500).json({ message: "Failed to add medicine" });
  }
});

app.get("/medicines", ensureDb, verifyToken, async (req, res) => {
  try {
    const medicines = await Medicine.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .lean();
    res.json(medicines.map((medicine) => medicineView(medicine)));
  } catch (err) {
    console.log("Get medicine error:", err.message);
    res.status(500).json({ message: "Failed to fetch medicines" });
  }
});

app.delete("/medicines/:id", ensureDb, verifyToken, async (req, res) => {
  const role = String(req.user?.role || "").toLowerCase();
  const canManageAll = ["admin", "staff", "pharmacist"].includes(role);
  const filter = canManageAll
    ? { _id: req.params.id }
    : { _id: req.params.id, user_id: req.user.id };

  try {
    const deleted = await Medicine.findOneAndDelete(filter).lean();
    if (!deleted) return res.status(404).json({ message: "Medicine not found" });

    await Review.deleteMany({ medicine_id: deleted._id });
    res.json({ message: "Medicine deleted" });
  } catch (err) {
    console.log("Delete medicine error:", err.message);
    res.status(500).json({ message: "Delete failed" });
  }
});

app.post("/checkins", ensureDb, verifyToken, async (req, res) => {
  const answers = req.body.answers || {};
  const feeling = answers[0] || answers.feeling || req.body.feeling;
  const symptoms = answers[1] || answers.symptoms || req.body.symptoms;
  const pills = answers[2] || answers.pills || req.body.pills;

  if (!feeling || !symptoms || !pills) {
    return res.status(400).json({ message: "Please answer all check-in questions" });
  }

  try {
    const checkin = await Checkin.create({
      user_id: req.user.id,
      feeling,
      symptoms,
      pills,
      answers_json: JSON.stringify(answers),
    });

    await logActivity(req.user.id, "weekly_checkin", `Feeling: ${feeling}; Symptoms: ${symptoms}; Pills: ${pills}`);

    res.json({
      message: "Check-in saved",
      checkin: {
        id: docId(checkin),
        user_id: req.user.id,
        feeling,
        symptoms,
        pills,
        created_at: checkin.created_at,
      },
    });
  } catch (err) {
    console.log("CHECK-IN SAVE ERROR:", err.message);
    res.status(500).json({ message: "Could not save check-in" });
  }
});

app.get("/my-checkins", ensureDb, verifyToken, async (req, res) => {
  try {
    const checkins = await Checkin.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .limit(12)
      .lean();

    res.json(
      checkins.map((checkin) => ({
        id: docId(checkin),
        user_id: docId(checkin.user_id),
        feeling: checkin.feeling,
        symptoms: checkin.symptoms,
        pills: checkin.pills,
        created_at: checkin.created_at,
      }))
    );
  } catch (err) {
    console.log("MY CHECKINS ERROR:", err.message);
    res.status(500).json({ message: "Could not load check-ins" });
  }
});

app.get("/test-staff-medicines", ensureDb, async (req, res) => {
  try {
    const medicines = await Medicine.find()
      .sort({ created_at: -1 })
      .populate("user_id")
      .lean();
    res.json(medicines.map((medicine) => medicineView(medicine, medicine.user_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/staff/medicines", ensureDb, verifyToken, requireRole("admin", "staff", "pharmacist"), async (req, res) => {
  try {
    const medicines = await Medicine.find()
      .sort({ created_at: -1 })
      .populate("user_id")
      .lean();

    res.json(medicines.map((medicine) => medicineView(medicine, medicine.user_id)));
  } catch (err) {
    console.log("STAFF MEDICINES ERROR:", err.message);
    res.status(500).json({ message: "Could not load staff medicines" });
  }
});

app.post("/reviews", ensureDb, verifyToken, requireRole("admin", "staff", "pharmacist"), async (req, res) => {
  const {
    medicine_id,
    patient_id,
    problem_category,
    problem_cause,
    intervention_done,
    treatment_stage,
    details,
    notes,
  } = req.body;

  if (!medicine_id || !patient_id || !problem_category || !intervention_done) {
    return res.status(400).json({
      message: "Medicine, patient, problem and intervention are required",
    });
  }

  try {
    const review = await Review.create({
      medicine_id,
      patient_id,
      admin_id: req.user.id,
      problem_category,
      problem_cause: problem_cause || null,
      intervention_done,
      treatment_stage: treatment_stage || "Started",
      details: details || null,
      notes: notes || null,
    });

    await Medicine.updateOne({ _id: medicine_id }, { $set: { status: "reviewed" } });
    res.json({ message: "Review saved" });

    notifyPatientReview({
      medicine_id,
      patient_id,
      problem_category,
      problem_cause,
      intervention_done,
      treatment_stage: treatment_stage || "Started",
      details,
      notes,
    }).catch((notificationErr) => {
      console.log("REVIEW NOTIFICATION ERROR:", notificationErr.message);
    });
  } catch (err) {
    console.log("REVIEW SAVE ERROR:", err.message);
    res.status(500).json({ message: "Review failed" });
  }
});

app.get("/my-reviews", ensureDb, verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ patient_id: req.user.id })
      .sort({ created_at: -1 })
      .populate("medicine_id")
      .populate("admin_id")
      .lean();

    res.json(
      reviews.map((review) =>
        reviewView(review, review.medicine_id, review.admin_id)
      )
    );
  } catch (err) {
    console.log("MY REVIEWS ERROR:", err.message);
    res.status(500).json({ message: "Could not load reviews" });
  }
});

module.exports = app;
