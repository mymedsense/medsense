require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;
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

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "medsense123",
  database: process.env.DB_NAME || "medsense",
});

db.connect((err) => {
  if (err) console.log("MySQL Error:", err);
  else {
    console.log("MySQL Connected");
    ensureSchema();
  }
});

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

function logActivity(userId, action, details) {
  db.query(
    "INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)",
    [userId, action, details],
    (err) => {
      if (err) console.log("Activity log error:", err);
    }
  );
}

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function ensureSchema() {
  db.query(
    `CREATE TABLE IF NOT EXISTS checkins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      feeling VARCHAR(80) NOT NULL,
      symptoms VARCHAR(80) NOT NULL,
      pills VARCHAR(80) NOT NULL,
      answers_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id)
    )`,
    (err) => {
      if (err) console.log("Check-ins table setup error:", err);
      else console.log("Check-ins table ready");
    }
  );
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

  console.log(`Email notification sent to ${patient.patient_email}`);
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
  if (!patient.patient_phone) {
    console.log("WhatsApp notification skipped: patient phone is missing");
    return;
  }

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log("WhatsApp notification skipped: WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not configured");
    return;
  }

  const to = normalizeWhatsappNumber(patient.patient_phone);

  if (!to) {
    console.log("WhatsApp notification skipped: patient phone could not be normalized");
    return;
  }

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await axios.post(url, buildWhatsappPayload(to, notification), {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const messageId = response.data?.messages?.[0]?.id || "accepted";
  console.log(`WhatsApp notification sent to ${to}: ${messageId}`);
}

async function notifyPatientReview(reviewData) {
  const results = await queryAsync(
    `SELECT
      users.name AS patient_name,
      users.email AS patient_email,
      users.phone AS patient_phone,
      medicines.name AS medicine_name,
      medicines.dosage,
      medicines.time
     FROM users
     LEFT JOIN medicines ON medicines.id = ? AND medicines.user_id = users.id
     WHERE users.id = ?
     LIMIT 1`,
    [reviewData.medicine_id, reviewData.patient_id]
  );

  if (results.length === 0) {
    console.log("Notification skipped: patient was not found");
    return;
  }

  const patient = results[0];
  const notification = buildReviewNotification(patient, reviewData);
  const deliveries = await Promise.allSettled([
    sendReviewEmail(patient, notification),
    sendReviewWhatsapp(patient, notification),
  ]);

  deliveries.forEach((delivery) => {
    if (delivery.status === "rejected") {
      console.log("Notification delivery error:", delivery.reason?.response?.data || delivery.reason?.message || delivery.reason);
    }
  });
}

app.get("/", (req, res) => {
  res.send("MedSense backend working");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "medsense-backend" });
});

app.get("/me", verifyToken, (req, res) => {
  db.query(
    "SELECT id, name, email, role, age, gender, phone, condition_summary FROM users WHERE id = ? LIMIT 1",
    [req.user.id],
    (err, results) => {
      if (err) {
        console.log("ME ERROR:", err);
        return res.status(500).json({ message: "Could not load user" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(results[0]);
    }
  );
});

/* REGISTER */
app.post("/register", (req, res) => {
  const { name, email, password, age, gender, phone } = req.body;

  console.log("REGISTER ROUTE HIT");
  console.log("BODY:", req.body);

  if (!name || !email || !password || !age || !phone) {
    return res.status(400).json({ message: "All fields required" });
  }

  db.query(
    "INSERT INTO users (name, email, password, role, age, gender, phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, email, password, "patient", age, gender || null, phone],
    (err) => {
      if (err) {
        console.log("REGISTER ERROR:", err);
        return res.status(400).json({ message: "Email already exists" });
      }

      res.json({ message: "Patient registered successfully" });
    }
  );
});
/* LOGIN */
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Server error" });

      if (results.length === 0) {
        return res.status(401).json({ message: "Invalid login" });
      }

      const user = results[0];

      if (String(password).trim() !== String(user.password).trim()) {
        return res.status(401).json({ message: "Invalid login" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          age: user.age,
          gender: user.gender,
          phone: user.phone,
        },
      });
    }
  );
});
/* ADD MEDICINE */
app.post("/medicines", verifyToken, (req, res) => {
  const { name, condition_name, dosage, time, frequency, route, instructions } = req.body;

  if (!name || !dosage || !time) {
    return res.status(400).json({ message: "All medicine fields required" });
  }

  db.query(
    `INSERT INTO medicines
      (user_id, name, condition_name, dosage, time, frequency, route, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      name,
      condition_name || null,
      dosage,
      time,
      frequency || null,
      route || null,
      instructions || null,
    ],
    (err, result) => {
      if (err) {
        console.log("Add medicine error:", err);
        return res.status(500).json({ message: "Failed to add medicine" });
      }

      res.json({
        message: "Medicine added successfully",
        id: result.insertId,
      });

      if (condition_name) {
        db.query(
          "UPDATE users SET condition_summary = ? WHERE id = ?",
          [condition_name, req.user.id],
          (updateErr) => {
            if (updateErr) console.log("Condition update error:", updateErr);
          }
        );
      }
    }
  );
});

/* GET MEDICINES */
app.get("/medicines", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM medicines WHERE user_id = ? ORDER BY created_at DESC",
    [req.user.id],
    (err, results) => {
      if (err) {
        console.log("Get medicine error:", err);
        return res.status(500).json({ message: "Failed to fetch medicines" });
      }

      res.json(results);
    }
  );
});

/* DELETE MEDICINE */
app.delete("/medicines/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const role = String(req.user?.role || "").toLowerCase();
  const canManageAll = ["admin", "staff", "pharmacist"].includes(role);
  const deleteMedicineSql = canManageAll
    ? "DELETE FROM medicines WHERE id = ?"
    : "DELETE FROM medicines WHERE id = ? AND user_id = ?";
  const deleteMedicineParams = canManageAll ? [id] : [id, req.user.id];

  db.beginTransaction((transactionErr) => {
    if (transactionErr) {
      console.log("Delete medicine transaction error:", transactionErr);
      return res.status(500).json({ message: "Delete failed" });
    }

    db.query("DELETE FROM reviews WHERE medicine_id = ?", [id], (reviewErr) => {
      if (reviewErr) {
        return db.rollback(() => {
          console.log("Delete medicine reviews error:", reviewErr);
          res.status(500).json({ message: "Delete failed" });
        });
      }

      db.query(deleteMedicineSql, deleteMedicineParams, (medicineErr, result) => {
        if (medicineErr) {
          return db.rollback(() => {
            console.log("Delete medicine error:", medicineErr);
            res.status(500).json({ message: "Delete failed" });
          });
        }

        if (result.affectedRows === 0) {
          return db.rollback(() => {
            res.status(404).json({ message: "Medicine not found" });
          });
        }

        db.commit((commitErr) => {
          if (commitErr) {
            return db.rollback(() => {
              console.log("Delete medicine commit error:", commitErr);
              res.status(500).json({ message: "Delete failed" });
            });
          }

          res.json({ message: "Medicine deleted" });
        });
      });
    });
  });
});

app.post("/checkins", verifyToken, (req, res) => {
  const answers = req.body.answers || {};
  const feeling = answers[0] || answers.feeling || req.body.feeling;
  const symptoms = answers[1] || answers.symptoms || req.body.symptoms;
  const pills = answers[2] || answers.pills || req.body.pills;

  if (!feeling || !symptoms || !pills) {
    return res.status(400).json({ message: "Please answer all check-in questions" });
  }

  db.query(
    `INSERT INTO checkins (user_id, feeling, symptoms, pills, answers_json)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, feeling, symptoms, pills, JSON.stringify(answers)],
    (err, result) => {
      if (err) {
        console.log("CHECK-IN SAVE ERROR:", err);
        return res.status(500).json({ message: "Could not save check-in" });
      }

      logActivity(req.user.id, "weekly_checkin", `Feeling: ${feeling}; Symptoms: ${symptoms}; Pills: ${pills}`);

      res.json({
        message: "Check-in saved",
        checkin: {
          id: result.insertId,
          user_id: req.user.id,
          feeling,
          symptoms,
          pills,
          created_at: new Date(),
        },
      });
    }
  );
});

app.get("/my-checkins", verifyToken, (req, res) => {
  db.query(
    `SELECT id, user_id, feeling, symptoms, pills, created_at
     FROM checkins
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 12`,
    [req.user.id],
    (err, results) => {
      if (err) {
        console.log("MY CHECKINS ERROR:", err);
        return res.status(500).json({ message: "Could not load check-ins" });
      }

      res.json(results);
    }
  );
});

app.get("/test-staff-medicines", (req, res) => {
  db.query(
    `SELECT medicines.*, users.name AS patient_name, users.email AS patient_email
     FROM medicines
     LEFT JOIN users ON medicines.user_id = users.id
     ORDER BY medicines.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

app.get("/staff/medicines", verifyToken, requireRole("admin", "staff", "pharmacist"), (req, res) => {
  db.query(
    `SELECT
      medicines.*,
      users.name AS patient_name,
      users.email AS patient_email,
      users.phone AS patient_phone,
      users.age AS patient_age,
      users.gender AS patient_gender,
      users.condition_summary
     FROM medicines
     LEFT JOIN users ON medicines.user_id = users.id
     ORDER BY medicines.created_at DESC`,
    (err, results) => {
      if (err) {
        console.log("STAFF MEDICINES ERROR:", err);
        return res.status(500).json({ message: "Could not load staff medicines" });
      }

      res.json(results);
    }
  );
});

app.post("/reviews", verifyToken, requireRole("admin", "staff", "pharmacist"), (req, res) => {
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

  db.beginTransaction((transactionErr) => {
    if (transactionErr) {
      console.log("REVIEW TRANSACTION ERROR:", transactionErr);
      return res.status(500).json({ message: "Review failed" });
    }

    db.query(
      `INSERT INTO reviews
        (medicine_id, patient_id, admin_id, problem_category, problem_cause,
         intervention_done, treatment_stage, details, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_id,
        patient_id,
        req.user.id,
        problem_category,
        problem_cause || null,
        intervention_done,
        treatment_stage || "Started",
        details || null,
        notes || null,
      ],
      (insertErr) => {
        if (insertErr) {
          return db.rollback(() => {
            console.log("REVIEW INSERT ERROR:", insertErr);
            res.status(500).json({ message: "Review failed" });
          });
        }

        db.query(
          "UPDATE medicines SET status = 'reviewed' WHERE id = ?",
          [medicine_id],
          (updateErr) => {
            if (updateErr) {
              return db.rollback(() => {
                console.log("REVIEW STATUS ERROR:", updateErr);
                res.status(500).json({ message: "Review failed" });
              });
            }

            db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => {
                  console.log("REVIEW COMMIT ERROR:", commitErr);
                  res.status(500).json({ message: "Review failed" });
                });
              }

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
                console.log("REVIEW NOTIFICATION ERROR:", notificationErr);
              });
            });
          }
        );
      }
    );
  });
});

app.get("/my-reviews", verifyToken, (req, res) => {
  db.query(
    `SELECT
      reviews.*,
      medicines.name AS medicine_name,
      medicines.dosage,
      medicines.time,
      users.name AS pharmacist_name
     FROM reviews
     LEFT JOIN medicines ON reviews.medicine_id = medicines.id
     LEFT JOIN users ON reviews.admin_id = users.id
     WHERE reviews.patient_id = ?
     ORDER BY reviews.created_at DESC`,
    [req.user.id],
    (err, results) => {
      if (err) {
        console.log("MY REVIEWS ERROR:", err);
        return res.status(500).json({ message: "Could not load reviews" });
      }

      res.json(results);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
