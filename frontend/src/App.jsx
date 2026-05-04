import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FileText,
  Home,
  LogOut,
  PlusCircle,
  Settings,
  Trash2,
} from "lucide-react";

const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://api.mymedsense.co" : "http://localhost:5000");

function hasDashboardDeepLink() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("open") === "dashboard";
}

function getGreetingForTime(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => getGreetingForTime());

  useEffect(() => {
    const updateGreeting = () => setGreeting(getGreetingForTime());
    updateGreeting();

    const timer = window.setInterval(updateGreeting, 60000);
    return () => window.clearInterval(timer);
  }, []);

  return greeting;
}

function formatDateTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function medicineDetails(item) {
  return [item.dosage, item.frequency, item.route].filter(Boolean).join(" - ");
}

const problemCauses = {
  "Unnecessary Drug Therapy": [
    "No medical indication",
    "Addictive/recreational drug use",
    "Nondrug therapy indicated",
    "Duplicate therapy",
    "Treating avoidable ADR",
  ],
  "Needs Additional Drug Therapy": [
    "Untreated condition",
    "Synergistic/potentiating therapy",
    "Preventive/prophylactic therapy",
  ],
  "Needs Different Drug Product": [
    "Dosage form inappropriate",
    "Contraindication present",
    "Condition refractory to drug",
    "Drug not indicated for condition",
    "More effective drug available",
  ],
  "Dosage Too Low": [
    "Ineffective dose",
    "Frequency inappropriate",
    "Duration inappropriate",
    "Incorrect storage",
    "Incorrect administration",
    "Drug interaction",
    "Needs additional monitoring",
  ],
  "Adverse Drug Reaction": [
    "Unsafe drug for patient",
    "Allergic reaction",
    "Incorrect administration",
    "Drug interaction",
    "Dosage increase/decrease too fast",
    "Undesirable effect",
  ],
  "Dosage Too High": [
    "Dose too high",
    "Frequency too short",
    "Duration too long",
    "Drug interaction",
    "Needs additional monitoring",
  ],
  Noncompliance: [
    "Drug product not available",
    "Patient cannot afford drug product",
    "Cannot swallow/administer",
    "Directions not understood",
    "Patient prefers not to take",
    "Patient forgets to take",
  ],
  Other: ["Other"],
};

const interventions = [
  "Drug regimen changed",
  "Drug added",
  "Drug withdrawn",
  "Drug refilled",
  "Dosage increased",
  "Dosage reduced",
  "Prescription issued",
  "Alert card issued",
  "Pharmacovigilance tools filled",
  "Patient/family counseled",
  "Legitimate, no intervention",
  "Rejected",
  "Other",
];

const medicineTimeOptions = [
  "Morning - 6:00 AM",
  "Breakfast - 8:00 AM",
  "Midday - 12:00 PM",
  "Lunch - 1:00 PM",
  "Afternoon - 3:00 PM",
  "Evening - 6:00 PM",
  "Night - 9:00 PM",
  "Bedtime - 10:00 PM",
  "When required",
];

const ageOptions = [
  { label: "18-24", value: "18" },
  { label: "25-34", value: "25" },
  { label: "35-44", value: "35" },
  { label: "45-54", value: "45" },
  { label: "55-64", value: "55" },
  { label: "65+", value: "65" },
];

const genderOptions = ["Female", "Male", "Prefer not to say"];

const conditionOptions = ["HTN", "Diabetes", "HIV", "TB", "CKD", "Asthma", "Heart Disease", "Other"];

const frequencyOptions = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Weekly",
  "When required",
];

const routeOptions = ["Oral", "Topical", "Injection", "Inhaled", "Eye drops"];

const instructionOptions = [
  "Before food",
  "After food",
  "With food",
  "At bedtime",
  "Take when required",
];

const walkthroughs = [
  {
    icon: "meds",
    title: "Your meds, organised.",
    body: "We read your prescription and build your personal daily schedule automatically.",
  },
  {
    icon: "ask",
    title: "Ask anything.",
    body: "Get plain-language answers about your drugs, interactions, and how to take them.",
  },
  {
    icon: "alert",
    title: "We've got your back.",
    body: "If something looks wrong, we alert you and connect you to a real clinician instantly.",
  },
];

const emptyMedicine = {
  name: "",
  condition_name: "",
  dosage: "",
  time: "",
  frequency: "",
  route: "",
  instructions: "",
};

const emptyReview = {
  problem_category: "Needs Different Drug Product",
  problem_cause: "More effective drug available",
  intervention_done: "Drug added",
  treatment_stage: "Started",
  details: "",
  notes: "",
};

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(() =>
    hasDashboardDeepLink() ? "login" : "welcome"
  );
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    email: "",
    password: "",
  });
  const [pendingUser, setPendingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("self");
  const [caregiverData, setCaregiverData] = useState({
    name: "",
    age: "",
    relationship: "",
    phone: "",
  });
  const [patientTab, setPatientTab] = useState("home");
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [medicine, setMedicine] = useState(emptyMedicine);
  const [medicines, setMedicines] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [staffMedicines, setStaffMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [adminDeleteId, setAdminDeleteId] = useState(null);
  const [adminDeletingId, setAdminDeletingId] = useState(null);
  const [review, setReview] = useState(emptyReview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const auth = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }), []);

  const role = String(user?.role || "").toLowerCase();
  const isPatient = role === "patient";
  const causes = useMemo(
    () => problemCauses[review.problem_category] || [],
    [review.problem_category]
  );
  const reviewedCount = medicines.filter((item) => item.status === "reviewed").length;
  const nextMedicine = medicines[0];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get(`${API}/me`, auth())
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"));
  }, [auth]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API}/login`, loginData);
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      if (hasDashboardDeepLink()) setPatientTab("home");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const signup = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(`${API}/register`, {
        name: signupData.name,
        age: Number(signupData.age),
        gender: signupData.gender,
        phone: signupData.phone,
        email: signupData.email,
        password: signupData.password,
      });

      const res = await axios.post(`${API}/login`, {
        email: signupData.email,
        password: signupData.password,
      });

      localStorage.setItem("token", res.data.token);
      setPendingUser(res.data.user);
      setAuthMode("role");
      setSignupData({ name: "", age: "", gender: "", phone: "", email: "", password: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = () => {
    if (pendingUser) {
      setUser(pendingUser);
      setPendingUser(null);
    } else {
      setAuthMode("login");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setPendingUser(null);
    setAuthMode("welcome");
    setMedicines([]);
    setReviews([]);
    setStaffMedicines([]);
    setSelectedMedicine(null);
    setAdminDeleteId(null);
    setAdminDeletingId(null);
    setPatientTab("home");
  };

  const loadPatient = useCallback(async () => {
    setError("");

    try {
      const [meds, revs] = await Promise.all([
        axios.get(`${API}/medicines`, auth()),
        axios.get(`${API}/my-reviews`, auth()),
      ]);

      setMedicines(meds.data);
      setReviews(revs.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load patient data");
    }
  }, [auth]);

  const loadAdmin = useCallback(async () => {
    setError("");

    try {
      const res = await axios.get(`${API}/staff/medicines`, auth());
      setStaffMedicines(res.data);
      setAdminDeleteId(null);
      setSelectedMedicine((current) => {
        if (res.data.length === 0) return null;
        return res.data.find((item) => item.id === current?.id) || res.data[0];
      });
    } catch (err) {
      setStaffMedicines([]);
      setSelectedMedicine(null);
      setAdminDeleteId(null);
      setError(err.response?.data?.message || "Could not load admin medicines");
    }
  }, [auth]);

  useEffect(() => {
    if (!user) return;

    let isCurrent = true;

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      if (isPatient) return loadPatient();
      return loadAdmin();
    });

    return () => {
      isCurrent = false;
    };
  }, [user, isPatient, loadPatient, loadAdmin]);

  const addMedicine = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await axios.post(`${API}/medicines`, medicine, auth());
      setMedicine(emptyMedicine);
      await loadPatient();
      setPatientTab("review-send");
    } catch (err) {
      setError(err.response?.data?.message || "Could not add medicine");
    }
  };

  const deleteMedicine = async (medicineId) => {
    const shouldDelete = window.confirm("Remove this medicine from your list?");
    if (!shouldDelete) return;

    setError("");

    try {
      await axios.delete(`${API}/medicines/${medicineId}`, auth());
      await loadPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove medicine");
    }
  };

  const deleteAdminMedicine = async (medicineId) => {
    setError("");
    setAdminDeletingId(medicineId);

    try {
      await axios.delete(`${API}/medicines/${medicineId}`, auth());
      setAdminDeleteId(null);
      await loadAdmin();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete medicine");
    } finally {
      setAdminDeletingId(null);
    }
  };


  const toggleCondition = (condition) => {
    setSelectedConditions((current) =>
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition]
    );
  };

  const chooseProblem = (problem_category) => {
    setReview({
      ...review,
      problem_category,
      problem_cause: problemCauses[problem_category][0],
    });
  };

  const saveReview = async (event) => {
    event.preventDefault();
    if (!selectedMedicine) return;
    setError("");

    try {
      await axios.post(
        `${API}/reviews`,
        {
          medicine_id: selectedMedicine.id,
          patient_id: selectedMedicine.user_id,
          ...review,
        },
        auth()
      );

      setReview(emptyReview);
      await loadAdmin();
      alert("Review saved");
    } catch (err) {
      setError(err.response?.data?.message || "Review failed");
    }
  };

  if (!user) {
    return (
      <main className="app-backdrop">
        <style>{styles}</style>
        <PhoneShell variant="auth">
          {authMode === "welcome" && (
            <WelcomeScreen
              onGetStarted={() => setAuthMode("tour-0")}
              onSignIn={() => setAuthMode("login")}
            />
          )}

          {authMode.startsWith("tour-") && (
            <TourScreen
              step={Number(authMode.split("-")[1])}
              onBack={(step) =>
                step === 0 ? setAuthMode("welcome") : setAuthMode(`tour-${step - 1}`)
              }
              onNext={(step) =>
                step === walkthroughs.length - 1
                  ? setAuthMode("signup")
                  : setAuthMode(`tour-${step + 1}`)
              }
            />
          )}

          {authMode === "login" && (
            <AuthScreen
              mode="login"
              error={error}
              loading={loading}
              loginData={loginData}
              setLoginData={setLoginData}
              onSubmit={login}
              onSwitch={() => setAuthMode("signup")}
              onBack={() => setAuthMode("welcome")}
            />
          )}

          {authMode === "signup" && (
            <AuthScreen
              mode="signup"
              error={error}
              loading={loading}
              signupData={signupData}
              setSignupData={setSignupData}
              selectedConditions={selectedConditions}
              onToggleCondition={toggleCondition}
              onSubmit={signup}
              onSwitch={() => setAuthMode("login")}
              onBack={() => setAuthMode("tour-2")}
            />
          )}

          {authMode === "role" && (
            <RoleScreen
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              onStart={() =>
                selectedRole === "family" ? setAuthMode("caregiver") : finishOnboarding()
              }
            />
          )}

          {authMode === "caregiver" && (
            <CaregiverScreen
              caregiverData={caregiverData}
              setCaregiverData={setCaregiverData}
              onBack={() => setAuthMode("role")}
              onStart={finishOnboarding}
            />
          )}
        </PhoneShell>
      </main>
    );
  }

  if (isPatient) {
    return (
      <main className="app-backdrop">
        <style>{styles}</style>
        <PhoneShell variant="patient">
          <AppHeader user={user} />
          {error && <p className="error">{error}</p>}

          {patientTab === "home" && (
            <PatientHome
              user={user}
              medicines={medicines}
              reviews={reviews}
              reviewedCount={reviewedCount}
              nextMedicine={nextMedicine}
              onAdd={() => setPatientTab("add")}
              onReviews={() => setPatientTab("reviews")}
              onRemove={deleteMedicine}
            />
          )}

          {patientTab === "add" && (
            <AddMedicineForm
              medicine={medicine}
              setMedicine={setMedicine}
              onSubmit={addMedicine}
            />
          )}

          {patientTab === "reviews" && <ReviewList reviews={reviews} />}

          {patientTab === "review-send" && (
            <ReviewSendScreen
              patientName={user.name || "the patient"}
              medicines={medicines}
              onAdd={() => setPatientTab("add")}
              onSend={() => setPatientTab("submitted")}
              onRemove={deleteMedicine}
            />
          )}

          {patientTab === "submitted" && (
            <SubmittedScreen onDone={() => setPatientTab("home")} />
          )}


          {patientTab === "plan" && (
            <PlanScreen onPay={() => setPatientTab("pay")} />
          )}

          {patientTab === "pay" && (
            <PayScreen user={user} onDone={() => setPatientTab("profile")} />
          )}

          {patientTab === "profile" && (
            <ProfilePanel
              user={user}
              onLogout={logout}
              reviewedCount={reviewedCount}
              onPlan={() => setPatientTab("plan")}
            />
          )}

          <BottomNav active={patientTab} onChange={setPatientTab} />
        </PhoneShell>
      </main>
    );
  }

  return (
    <main className="app-backdrop">
      <style>{styles}</style>
      <PhoneShell variant="admin">
        <AppHeader user={user} mode="admin" onLogout={logout} />
        {error && <p className="error">{error}</p>}

        <section className="screen-section">
          <p className="eyebrow">Admin queue</p>
          <h1>Medication review</h1>
          <div className="admin-summary">
            <span>{staffMedicines.length} submitted</span>
            <span>{staffMedicines.filter((item) => item.status !== "reviewed").length} pending</span>
          </div>
        </section>

        <section className="queue-list">
          {staffMedicines.map((item) => (
            <article
              className={`medicine-ticket ${selectedMedicine?.id === item.id ? "selected" : ""} ${adminDeleteId === item.id ? "delete-armed" : ""}`}
              key={item.id}
            >
              <button
                className="medicine-ticket-main"
                onClick={() => setSelectedMedicine(item)}
                type="button"
              >
                <span className="dot" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.patient_name || "Unknown patient"} - {item.patient_phone || "No phone"}
                  </small>
                  <small>
                    Age: {item.patient_age || "Not set"} - Gender: {item.patient_gender || "Not set"}
                  </small>
                  <small>
                    Condition: {item.condition_name || item.condition_summary || "No condition"}
                  </small>
                </span>
                <b className={item.status === "reviewed" ? "status-reviewed" : "status-pending"}>
                  {item.status}
                </b>
              </button>

              {adminDeleteId === item.id ? (
                <div className="admin-delete-confirmation">
                  <button
                    className="danger-confirm"
                    disabled={adminDeletingId === item.id}
                    onClick={() => deleteAdminMedicine(item.id)}
                    type="button"
                  >
                    {adminDeletingId === item.id ? "Deleting" : "Confirm"}
                  </button>
                  <button
                    className="tiny-button admin-delete-cancel"
                    disabled={adminDeletingId === item.id}
                    onClick={() => setAdminDeleteId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="icon-button danger admin-delete-trigger"
                  onClick={() => setAdminDeleteId(item.id)}
                  type="button"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 aria-hidden="true" size={17} strokeWidth={2.4} />
                </button>
              )}
            </article>
          ))}

          {staffMedicines.length === 0 && (
            <EmptyState title="No medicines yet" text="Patient submissions will appear here." />
          )}
        </section>

        <AdminReviewForm
          selectedMedicine={selectedMedicine}
          review={review}
          causes={causes}
          onProblemChange={chooseProblem}
          setReview={setReview}
          onSubmit={saveReview}
        />
      </PhoneShell>
    </main>
  );
}

function PhoneShell({ children, variant = "app" }) {
  return (
    <section className={`phone-shell ${variant}-shell`}>
      {children}
    </section>
  );
}

function PillLogo() {
  return <div className="pill-logo" aria-hidden="true" />;
}

function WelcomeScreen({ onGetStarted, onSignIn }) {
  return (
    <section className="center-screen">
      <PillLogo />
      <h1 className="brand-title">MedSense</h1>
      <p className="brand-copy">
        Medication intelligence for people managing chronic conditions.
      </p>
      <button className="primary wide" onClick={onGetStarted}>
        Get Started
      </button>
      <button className="link-button" onClick={onSignIn}>
        Already have an account? Sign in
      </button>
    </section>
  );
}

function TourScreen({ step, onBack, onNext }) {
  const item = walkthroughs[step];

  return (
    <section className="center-screen">
      <WalkIcon type={item.icon} />
      <h1>{item.title}</h1>
      <p>{item.body}</p>
      <div className="dots">
        {walkthroughs.map((_, index) => (
          <span className={index === step ? "active" : ""} key={index} />
        ))}
      </div>
      <div className="button-row">
        <button className="secondary" onClick={() => onBack(step)}>
          Back
        </button>
        <button className="primary" onClick={() => onNext(step)}>
          {step === walkthroughs.length - 1 ? "Create Account" : "Next"}
        </button>
      </div>
    </section>
  );
}

function WalkIcon({ type }) {
  if (type === "meds") return <div className="walk-icon meds-icon" />;
  if (type === "ask") return <div className="walk-icon ask-icon" />;
  return <div className="walk-icon alert-icon" />;
}

function AuthScreen({
  mode,
  error,
  loading,
  loginData,
  setLoginData,
  signupData,
  setSignupData,
  selectedConditions = [],
  onToggleCondition,
  onSubmit,
  onSwitch,
  onBack,
}) {
  const isSignup = mode === "signup";

  return (
    <form className="auth-screen" onSubmit={onSubmit}>
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1>{isSignup ? "Create your account" : "Sign in"}</h1>
      <p>MedSense - Kenya's medication companion</p>

      {error && <p className="error">{error}</p>}

      {isSignup && (
        <label>
          Username
          <input
            required
            value={signupData.name}
            placeholder="Mary"
            onChange={(event) =>
              setSignupData({ ...signupData, name: event.target.value })
            }
          />
        </label>
      )}

      <label>
        Email address
        <input
          required
          type="email"
          value={isSignup ? signupData.email : loginData.email}
          placeholder="you@example.com"
          onChange={(event) =>
            isSignup
              ? setSignupData({ ...signupData, email: event.target.value })
              : setLoginData({ ...loginData, email: event.target.value })
          }
        />
      </label>

      {isSignup && (
        <label>
          Mobile number
          <input
            required
            type="tel"
            value={signupData.phone}
            placeholder="+254 700 000 000"
            onChange={(event) =>
              setSignupData({ ...signupData, phone: event.target.value })
            }
          />
        </label>
      )}

      <label>
        Password
        <input
          required
          type="password"
          minLength={isSignup ? 6 : undefined}
          value={isSignup ? signupData.password : loginData.password}
          placeholder={isSignup ? "Min. 6 characters" : "Password"}
          onChange={(event) =>
            isSignup
              ? setSignupData({ ...signupData, password: event.target.value })
              : setLoginData({ ...loginData, password: event.target.value })
          }
        />
      </label>

      {isSignup && (
        <>
          <label>
            Age range
            <select
              required
              value={signupData.age}
              onChange={(event) =>
                setSignupData({ ...signupData, age: event.target.value })
              }
            >
              <option value="">Select age range</option>
              {ageOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Gender
            <select
              required
              value={signupData.gender}
              onChange={(event) =>
                setSignupData({ ...signupData, gender: event.target.value })
              }
            >
              <option value="">Select gender</option>
              {genderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="condition-picker">
            <legend>Their conditions</legend>
            <div className="condition-chip-row">
              {conditionOptions.map((condition) => (
                <button
                  className={selectedConditions.includes(condition) ? "mini-chip active" : "mini-chip"}
                  key={condition}
                  type="button"
                  onClick={() => onToggleCondition?.(condition)}
                >
                  {condition}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="consent">
            By continuing you agree to our Terms of Service, Data Policy and
            Privacy Policy. We collect your general location to improve care
            routing.
          </p>
        </>
      )}

      <button className="primary wide" disabled={loading}>
        {loading ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
      </button>
      <button className="link-button" type="button" onClick={onSwitch}>
        {isSignup ? "Already have an account? Sign in" : "Create an account"}
      </button>
    </form>
  );
}

function RoleScreen({ selectedRole, setSelectedRole, onStart }) {
  return (
    <section className="role-screen">
      <h1>How will you use MedSense?</h1>
      <p>Choose the option that fits you.</p>

      <button
        className={`role-card ${selectedRole === "self" ? "selected" : ""}`}
        type="button"
        onClick={() => setSelectedRole("self")}
      >
        <span className="person-icon" />
        <strong>Managing my own medications</strong>
        <small>I'm the patient taking the medications.</small>
      </button>

      <button
        className={`role-card ${selectedRole === "family" ? "selected" : ""}`}
        type="button"
        onClick={() => setSelectedRole("family")}
      >
        <span className="shield-icon" />
        <strong>Managing for a family member</strong>
        <small>I support someone else's medication journey.</small>
      </button>

      <button className="primary wide" onClick={onStart}>
        Start MedSense
      </button>
    </section>
  );
}

function CaregiverScreen({ caregiverData, setCaregiverData, onBack, onStart }) {
  return (
    <form className="auth-screen" onSubmit={(event) => {
      event.preventDefault();
      onStart();
    }}>
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1>Add your family member</h1>
      <p>You will manage their medications from your account.</p>

      <label>
        Their name
        <input
          required
          value={caregiverData.name}
          placeholder="Mama Wanjiku"
          onChange={(event) =>
            setCaregiverData({ ...caregiverData, name: event.target.value })
          }
        />
      </label>

      <label>
        Age range
        <select
          required
          value={caregiverData.age}
          onChange={(event) =>
            setCaregiverData({ ...caregiverData, age: event.target.value })
          }
        >
          <option value="">Select age range</option>
          {["45-54", "55-64", "65-74", "75+"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Relationship
        <select
          required
          value={caregiverData.relationship}
          onChange={(event) =>
            setCaregiverData({ ...caregiverData, relationship: event.target.value })
          }
        >
          <option value="">Select relationship</option>
          {["Mother", "Father", "Spouse", "Sibling", "Grandparent", "Other relative"].map(
            (option) => (
              <option key={option} value={option}>
                {option}
              </option>
            )
          )}
        </select>
      </label>

      <label>
        Phone number
        <input
          value={caregiverData.phone}
          placeholder="+254 700 000 000"
          onChange={(event) =>
            setCaregiverData({ ...caregiverData, phone: event.target.value })
          }
        />
      </label>

      <button className="primary wide">Start MedSense</button>
    </form>
  );
}

function AppHeader({ user, mode = "patient", onLogout }) {
  const greeting = useTimeGreeting();

  return (
    <header className="app-header">
      <div>
        <small>{mode === "admin" ? "Pharmacist" : `Habari ${user.name || "there"}`}</small>
        <h1>{mode === "admin" ? "Admin" : greeting}</h1>
      </div>
      {onLogout && (
        <button className="logout-button" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>Log out</span>
        </button>
      )}
    </header>
  );
}

function PatientHome({
  medicines,
  reviews,
  reviewedCount,
  nextMedicine,
  onAdd,
  onReviews,
  onRemove,
}) {
  return (
    <>
      <section className="today-card">
        <div>
          <span>Medication plan</span>
          <strong>{medicines.length} medicines tracked</strong>
          <p>
            Next: {nextMedicine ? `${nextMedicine.name} at ${nextMedicine.time}` : "Add your first medicine"}
          </p>
        </div>
        <b>{reviewedCount} reviewed</b>
      </section>

      {reviews.length > 0 && (
        <button className="warning-card" type="button" onClick={onReviews}>
          <span />
          <p>{reviews[0].intervention_done} - tap here to read pharmacist notes</p>
        </button>
      )}


      <section className="section-title">
        <h2>My medicines today</h2>
        <button className="tiny-button" onClick={onAdd}>
          Add
        </button>
      </section>

      <section className="medicine-list">
        {medicines.map((item) => (
          <article className="medicine-card" key={item.id}>
            <span className="med-dot" />
            <div>
              <strong>{item.name}</strong>
              <p>{medicineDetails(item) || "Strength not set"}</p>
              <small>
                {item.time}
                {item.instructions ? ` - ${item.instructions}` : ""}
              </small>
            </div>
            <div className="medicine-actions">
              <b className={item.status === "reviewed" ? "ok" : "pending"}>
                {item.status === "reviewed" ? "reviewed" : "pending"}
              </b>
              <button
                className="icon-button danger"
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 aria-hidden="true" size={16} strokeWidth={2.4} />
              </button>
            </div>
          </article>
        ))}

        {medicines.length === 0 && (
          <EmptyState title="No medicines yet" text="Add your first medicine for pharmacist review." />
        )}
      </section>
    </>
  );
}

function ChoiceGroup({ title, options, value, onChoose }) {
  return (
    <fieldset className="choice-field">
      <legend>{title}</legend>
      <div className="choice-grid">
        {options.map((option) => (
          <button
            className={value === option ? "choice-button selected" : "choice-button"}
            key={option}
            type="button"
            onClick={() => onChoose(value === option ? "" : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AddMedicineForm({ medicine, setMedicine, onSubmit }) {
  return (
    <form className="form-screen" onSubmit={onSubmit}>
      <p className="eyebrow">Medication input</p>
      <h1>Add medicine</h1>

      <label>
        Medicine
        <input
          required
          value={medicine.name}
          placeholder="Amlodipine"
          onChange={(event) => setMedicine({ ...medicine, name: event.target.value })}
        />
      </label>

      <label>
        Strength
        <input
          required
          value={medicine.dosage}
          placeholder="5 mg"
          onChange={(event) => setMedicine({ ...medicine, dosage: event.target.value })}
        />
      </label>

      <ChoiceGroup
        title="Time"
        options={medicineTimeOptions}
        value={medicine.time}
        onChoose={(time) => setMedicine({ ...medicine, time })}
      />

      <ChoiceGroup
        title="Frequency"
        options={frequencyOptions}
        value={medicine.frequency}
        onChoose={(frequency) => setMedicine({ ...medicine, frequency })}
      />

      <ChoiceGroup
        title="Route"
        options={routeOptions}
        value={medicine.route}
        onChoose={(route) => setMedicine({ ...medicine, route })}
      />

      <ChoiceGroup
        title="Instructions"
        options={instructionOptions}
        value={medicine.instructions}
        onChoose={(instructions) => setMedicine({ ...medicine, instructions })}
      />

      <button
        className="primary wide"
        disabled={!medicine.name || !medicine.dosage || !medicine.time}
      >
        Save medicine
      </button>
    </form>
  );
}

function ReviewList({ reviews }) {
  return (
    <section className="form-screen">
      <p className="eyebrow">Pharmacist feedback</p>
      <h1>Reviews</h1>

      {reviews.map((item) => (
        <article className="review-card" key={item.id}>
          <span>{item.treatment_stage} - {formatDateTime(item.created_at)}</span>
          <h3>{item.medicine_name}</h3>
          <p>
            <b>Strength:</b> {item.dosage || "Not recorded"} - {item.time || "No time set"}
          </p>
          <p>
            <b>Problem:</b> {item.problem_category} - {item.problem_cause}
          </p>
          <p>
            <b>Intervention:</b> {item.intervention_done}
          </p>
          {item.details && <p>{item.details}</p>}
        </article>
      ))}

      {reviews.length === 0 && (
        <EmptyState title="No reviews yet" text="A pharmacist has not submitted feedback yet." />
      )}
    </section>
  );
}

function ReviewSendScreen({ patientName, medicines, onAdd, onSend, onRemove }) {
  return (
    <section className="form-screen">
      <p className="eyebrow">{patientName}'s medicines</p>
      <h1>Ready to send for review</h1>
      <p className="screen-copy">{medicines.length} medicines added</p>

      <section className="medicine-list">
        {medicines.map((item) => (
          <article className="medicine-card compact" key={item.id}>
            <span className="med-dot" />
            <div>
              <strong>{item.name}</strong>
              <p>{medicineDetails(item) || item.dosage} - {item.time}</p>
              <small>{item.instructions || "Ready for pharmacist review"}</small>
            </div>
            <div className="medicine-actions">
              <b className={item.status === "reviewed" ? "status-reviewed" : "status-pending"}>
                {item.status}
              </b>
              <button
                className="icon-button danger"
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 aria-hidden="true" size={16} strokeWidth={2.4} />
              </button>
            </div>
          </article>
        ))}
      </section>

      <button className="secondary wide" type="button" onClick={onAdd}>
        Add another medicine
      </button>
      <button className="primary wide" type="button" onClick={onSend}>
        Send for pharmacist review
      </button>
    </section>
  );
}

function SubmittedScreen({ onDone }) {
  return (
    <section className="center-screen submitted-screen">
      <div className="success-orb">✓</div>
      <h1>Got it, thanks!</h1>
      <p>A pharmacist is reviewing the medicines now.</p>
      <article className="advice-card">
        <strong>Quick advice while you wait</strong>
        <span>Keep taking medicines as usual until you hear from us.</span>
      </article>
      <button className="primary wide" onClick={onDone}>
        Got it
      </button>
    </section>
  );
}

function PlanScreen({ onPay }) {
  return (
    <section className="form-screen">
      <p className="eyebrow">Day 12 of free trial</p>
      <h1>Choose your plan</h1>
      <article className="plan-card">
        <div>
          <strong>Basic</strong>
          <p>Daily medicine schedule, AI reminders and pharmacist support.</p>
        </div>
        <b>300 KES/mo</b>
      </article>
      <article className="plan-card recommended">
        <div>
          <strong>Plus</strong>
          <p>Everything in Basic plus pharmacist review and monthly reports.</p>
        </div>
        <b>700 KES/mo</b>
      </article>
      <button className="primary wide" onClick={onPay}>
        Pay with M-Pesa
      </button>
    </section>
  );
}

function PayScreen({ user, onDone }) {
  return (
    <section className="form-screen">
      <p className="eyebrow">Pay with M-Pesa</p>
      <h1>Plus plan</h1>
      <article className="profile-card">
        <span>Phone number</span>
        <strong>{user.phone || "+254 712 345 678"}</strong>
      </article>
      <article className="profile-card">
        <span>First month</span>
        <strong>700 KES</strong>
      </article>
      <button className="primary wide" onClick={onDone}>
        Send STK push
      </button>
      <button className="link-button" onClick={onDone}>
        Cancel anytime in Settings
      </button>
    </section>
  );
}

function ProfilePanel({ user, onLogout, reviewedCount, onPlan }) {
  return (
    <section className="form-screen">
      <p className="eyebrow">Settings</p>
      <h1>Your account</h1>
      <article className="profile-card">
        <span>Name</span>
        <strong>{user.name}</strong>
      </article>
      <article className="profile-card">
        <span>Mobile</span>
        <strong>{user.phone || "Not set"}</strong>
      </article>
      <article className="profile-card">
        <span>Reviewed medicines</span>
        <strong>{reviewedCount}</strong>
      </article>
      <article className="profile-card action-card" onClick={onPlan}>
        <span>Subscription</span>
        <strong>Choose plan</strong>
      </article>
      <article className="profile-card">
        <span>Support</span>
        <strong>Message pharmacist</strong>
      </article>
      <button className="logout-button wide settings-logout" onClick={onLogout} type="button">
        <LogOut aria-hidden="true" size={18} strokeWidth={2.5} />
        <span>Log out</span>
      </button>
    </section>
  );
}

function AdminReviewForm({
  selectedMedicine,
  review,
  causes,
  onProblemChange,
  setReview,
  onSubmit,
}) {
  if (!selectedMedicine) return null;

  return (
    <form className="admin-review" onSubmit={onSubmit}>
      <p className="eyebrow">After review</p>
      <h2>{selectedMedicine.name}</h2>
      <article className="admin-patient-card">
        <span>Patient details</span>
        <strong>{selectedMedicine.patient_name || "Unknown patient"}</strong>
        <dl className="admin-detail-grid">
          <div>
            <dt>Mobile</dt>
            <dd>{selectedMedicine.patient_phone || "Not set"}</dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{selectedMedicine.patient_age || "Not set"}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{selectedMedicine.patient_gender || "Not set"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedMedicine.patient_email || "Not set"}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{selectedMedicine.condition_name || selectedMedicine.condition_summary || "Not set"}</dd>
          </div>
        </dl>
      </article>

      <div className="mini-summary">
        <span>{selectedMedicine.dosage}</span>
        <span>{selectedMedicine.time}</span>
        <span>{selectedMedicine.frequency || "Frequency not set"}</span>
      </div>

      <label>
        Drug therapy problem
        <select
          value={review.problem_category}
          onChange={(event) => onProblemChange(event.target.value)}
        >
          {Object.keys(problemCauses).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>

      <label>
        Cause
        <select
          value={review.problem_cause}
          onChange={(event) =>
            setReview({ ...review, problem_cause: event.target.value })
          }
        >
          {causes.map((cause) => (
            <option key={cause}>{cause}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Intervention done</legend>
        <div className="chip-grid">
          {interventions.map((item, index) => (
            <button
              type="button"
              className={review.intervention_done === item ? "chip selected" : "chip"}
              key={item}
              onClick={() => setReview({ ...review, intervention_done: item })}
            >
              {index + 1}. {item}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Treatment stage</legend>
        <div className="segmented">
          {["Started", "Not Started"].map((stage) => (
            <button
              type="button"
              className={review.treatment_stage === stage ? "selected" : ""}
              key={stage}
              onClick={() => setReview({ ...review, treatment_stage: stage })}
            >
              {stage}
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        Details of the intervention
        <textarea
          rows="4"
          value={review.details}
          placeholder="Write notes for the patient..."
          onChange={(event) => setReview({ ...review, details: event.target.value })}
        />
      </label>

      <button className="primary wide">Submit review</button>
    </form>
  );
}

function BottomNav({ active, onChange }) {
  const items = [
    ["home", "Home", Home],
    ["add", "Add", PlusCircle],
    ["reviews", "Reviews", FileText],
    ["profile", "Settings", Settings],
  ];

  return (
    <nav className="bottom-nav">
      {items.map(([key, label, Icon]) => (
        <button
          key={key}
          className={active === key ? "active" : ""}
          onClick={() => onChange(key)}
          type="button"
        >
          <Icon aria-hidden="true" size={19} strokeWidth={2.4} />
          {label}
        </button>
      ))}
    </nav>
  );
}

function EmptyState({ title, text }) {
  return (
    <article className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg: #0a0f1e;
    --bg2: #111827;
    --bg3: #1a2236;
    --card: #161d2f;
    --card2: #1e2840;
    --border: #243050;
    --teal: #00d4aa;
    --teal2: #00b894;
    --blue: #3b82f6;
    --red: #ef4444;
    --orange: #f59e0b;
    --green: #10b981;
    --text: #f0f4ff;
    --text2: #8899bb;
    --text3: #4a5f80;
    color: var(--text);
    background: var(--bg);
    font-family: Sora, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
  }

  button, input, select, textarea {
    font: inherit;
  }

  button {
    border: 0;
    cursor: pointer;
  }

  h1, h2, h3, p {
    margin-top: 0;
  }

  .app-backdrop {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 18px;
    background:
      linear-gradient(90deg, rgba(126, 150, 213, 0.34) 1px, transparent 1px) calc(50% - 285px) 0 / 285px 100%,
      #2f3d77;
  }

  .phone-shell {
    width: min(100%, 390px);
    min-height: min(860px, calc(100vh - 36px));
    max-height: calc(100vh - 36px);
    overflow-y: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 18px 18px 78px;
    color: #ffffff;
  }

  .status-bar {
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 10px;
  }

  .center-screen {
    min-height: 650px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .pill-logo {
    width: 38px;
    height: 22px;
    border-radius: 999px;
    transform: rotate(-45deg);
    background: linear-gradient(90deg, #ffffff 0 50%, #ff927f 50% 100%);
    box-shadow: 0 12px 28px rgba(255, 146, 127, 0.24);
    margin-bottom: 14px;
  }

  .brand-title {
    font-size: 26px;
    line-height: 1;
    margin-bottom: 10px;
  }

  .brand-copy {
    width: min(260px, 100%);
    color: #f4f8ff;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.45;
    margin-bottom: 28px;
  }

  .primary,
  .secondary {
    min-height: 48px;
    border-radius: 8px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 900;
  }

  .primary {
    background: #eafffb;
    color: #40a995;
    box-shadow: 0 10px 24px rgba(6, 18, 43, 0.18);
  }

  .secondary {
    background: #6886df;
    color: #ffffff;
  }

  .wide {
    width: 100%;
  }

  .link-button,
  .back-link,
  .tiny-button {
    background: transparent;
    color: #dffcf6;
    font-size: 12px;
    font-weight: 900;
  }

  .logout-button {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.34);
    color: #ff6b6b;
    font-size: 12px;
    font-weight: 900;
    padding: 0 11px;
  }

  .logout-button svg {
    display: block;
  }

  .settings-logout {
    justify-content: center;
  }

  .link-button {
    margin-top: 12px;
  }

  .button-row {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1.65fr;
    gap: 10px;
    margin-top: 24px;
  }

  .alert-icon {
    width: 34px;
    height: 34px;
    border-radius: 50% 50% 8px 8px;
    background: #ffdf6b;
    position: relative;
    margin-bottom: 14px;
  }

  .alert-icon::after {
    content: "";
    position: absolute;
    left: 12px;
    bottom: -8px;
    width: 10px;
    height: 8px;
    border-radius: 0 0 8px 8px;
    background: #f6faff;
  }

  .center-screen h1 {
    font-size: 22px;
    margin-bottom: 8px;
  }

  .center-screen p {
    max-width: 280px;
    color: #eff5ff;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.45;
    margin-bottom: 22px;
  }

  .dots {
    display: flex;
    gap: 5px;
    align-items: center;
    margin-bottom: 6px;
  }

  .dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #9db5f7;
  }

  .dots .active {
    width: 18px;
    border-radius: 999px;
    background: #eafffb;
  }

  .auth-screen,
  .role-screen,
  .form-screen,
  .admin-review {
    display: grid;
    gap: 12px;
  }

  .auth-screen {
    padding-top: 18px;
  }

  .auth-screen h1,
  .role-screen h1,
  .form-screen h1 {
    text-align: center;
    font-size: 21px;
    margin-bottom: 0;
  }

  .auth-screen > p,
  .role-screen > p {
    text-align: center;
    color: #e8f0ff;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
  }

  input, select, textarea {
    width: 100%;
    min-height: 44px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #6f8ee8;
    color: #ffffff;
    padding: 11px 12px;
    outline: none;
    font-size: 13px;
    font-weight: 800;
  }

  textarea {
    resize: vertical;
    text-align: left;
  }

  input::placeholder,
  textarea::placeholder {
    color: #dbe7ff;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #71f2d3;
    box-shadow: 0 0 0 2px rgba(113, 242, 211, 0.24);
  }

  .consent,
  .error {
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    line-height: 1.4;
  }

  .consent {
    background: #6f8ee8;
    color: #eef5ff;
    font-weight: 800;
  }

  .error {
    background: #8f4560;
    color: #fff3f7;
    margin-bottom: 4px;
  }

  .role-screen {
    padding-top: 60px;
  }

  .role-card {
    min-height: 96px;
    display: grid;
    place-items: center;
    gap: 5px;
    background: #6f8ee8;
    color: #ffffff;
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }

  .role-card.selected {
    border-color: #71f2d3;
    background: #3d7e9d;
  }

  .role-card strong {
    font-size: 14px;
  }

  .role-card small {
    color: #edf4ff;
    font-weight: 800;
  }

  .person-icon,
  .shield-icon {
    width: 18px;
    height: 18px;
    background: #ffffff;
    display: block;
  }

  .person-icon {
    border-radius: 50% 50% 8px 8px;
  }

  .shield-icon {
    clip-path: polygon(50% 0, 100% 22%, 86% 82%, 50% 100%, 14% 82%, 0 22%);
  }

  .app-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  .app-header small {
    display: block;
    color: #e8f0ff;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
  }

  .app-header h1 {
    font-size: 24px;
    margin-bottom: 0;
  }

  .today-card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: start;
    background: #2d9aa7;
    border: 2px solid #56c8ce;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 30px rgba(20, 31, 76, 0.22);
  }

  .today-card span,
  .today-card p {
    color: #e8fcff;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 0;
  }

  .today-card strong {
    display: block;
    font-size: 25px;
    line-height: 1.1;
    margin: 4px 0;
  }

  .today-card b {
    background: #eafffb;
    color: #2d9aa7;
    border-radius: 8px;
    padding: 7px 8px;
    font-size: 12px;
  }

  .warning-card {
    width: 100%;
    display: flex;
    gap: 10px;
    align-items: center;
    background: #a94488;
    border: 1px solid #d66bb0;
    border-radius: 8px;
    padding: 13px;
    margin: 10px 0 18px;
    color: #ffffff;
    text-align: left;
  }

  .warning-card span {
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 16px solid #ffe7f3;
  }

  .warning-card p {
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 14px 0 10px;
  }

  .section-title h2 {
    color: #ffffff;
    font-size: 13px;
    text-transform: uppercase;
    margin-bottom: 0;
  }

  .medicine-list,
  .queue-list {
    display: grid;
    gap: 10px;
  }

  .medicine-card,
  .review-card,
  .profile-card,
  .empty-state,
  .medicine-ticket,
  .admin-review {
    background: #5d7bd3;
    border: 1px solid rgba(230, 240, 255, 0.16);
    border-radius: 10px;
    color: #ffffff;
  }

  .medicine-card {
    min-height: 78px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 13px;
  }

  .medicine-actions {
    display: grid;
    gap: 8px;
    justify-items: end;
  }

  .icon-button {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text2);
  }

  .icon-button.danger {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.28);
    color: #ff6b6b;
  }

  .med-dot,
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff27a;
  }

  .medicine-card strong,
  .medicine-ticket strong {
    display: block;
    font-size: 14px;
  }

  .medicine-card p,
  .medicine-card small,
  .medicine-ticket small,
  .review-card p,
  .empty-state p {
    color: #edf4ff;
    font-weight: 800;
  }

  .medicine-card p,
  .medicine-card small,
  .medicine-ticket small {
    display: block;
    margin-top: 3px;
  }

  .ok,
  .pending,
  .status-reviewed,
  .status-pending {
    border-radius: 999px;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 900;
  }

  .ok,
  .status-reviewed {
    background: #064e3b;
    color: #d1fae5;
    border: 1px solid #34d399;
  }

  .pending,
  .status-pending {
    background: #f4d35e;
    color: #745710;
  }

  .review-card,
  .profile-card,
  .empty-state,
  .admin-review {
    padding: 14px;
  }

  .patient-summary-card {
    display: grid;
    gap: 4px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    margin: 0 0 14px;
  }

  .patient-summary-card span,
  .patient-summary-card small {
    color: var(--text2);
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .patient-summary-card strong {
    font-size: 18px;
  }

  .patient-summary-card p,
  .profile-card p {
    color: var(--text2);
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 0;
  }

  .review-card span,
  .profile-card span,
  .eyebrow {
    color: #bff8ec;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .review-card h3 {
    margin: 6px 0;
  }

  .profile-card strong {
    display: block;
    margin-top: 6px;
  }

  .empty-state {
    text-align: center;
  }

  .admin-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 12px;
  }

  .admin-summary span,
  .mini-summary span {
    background: #5d7bd3;
    border-radius: 8px;
    padding: 10px;
    color: #f4f8ff;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
  }

  .medicine-ticket {
    width: 100%;
    min-height: 68px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    text-align: left;
  }

  .medicine-ticket.selected {
    border-color: #71f2d3;
    background: #3d7e9d;
  }

  .medicine-ticket.delete-armed {
    border-color: rgba(255, 107, 107, 0.66);
    background: #6d5a9d;
  }

  .medicine-ticket-main {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .medicine-ticket b {
    font-size: 11px;
    text-transform: uppercase;
  }

  .admin-delete-confirmation {
    min-width: 84px;
    display: grid;
    gap: 6px;
  }

  .danger-confirm {
    min-height: 30px;
    border-radius: 8px;
    background: var(--red);
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    padding: 0 10px;
  }

  .admin-delete-cancel {
    min-height: 28px;
    border-radius: 8px;
    color: #ffffff;
    background: rgba(255,255,255,0.08);
  }

  .admin-delete-trigger {
    color: #ffd4d4;
  }

  .admin-patient-card {
    display: grid;
    gap: 10px;
    margin-bottom: 14px;
  }

  .admin-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }

  .admin-detail-grid div {
    min-width: 0;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 9px;
  }

  .admin-detail-grid dt {
    color: #bff8ec;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .admin-detail-grid dd {
    margin: 4px 0 0;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .admin-detail-grid div:last-child {
    grid-column: 1 / -1;
  }

  .admin-review {
    margin-top: 14px;
  }

  .admin-review h2 {
    margin: 4px 0 10px;
  }

  .mini-summary {
    display: grid;
    gap: 8px;
    margin-bottom: 4px;
  }

  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  legend {
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    margin-bottom: 8px;
    text-transform: uppercase;
    text-align: center;
  }

  .chip-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .chip {
    min-height: 42px;
    border-radius: 8px;
    background: #6f8ee8;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    padding: 8px;
    text-align: left;
  }

  .chip.selected {
    background: #eafffb;
    color: #2d8578;
  }

  .choice-field {
    display: grid;
    gap: 8px;
  }

  .choice-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .choice-button {
    min-height: 42px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #6f8ee8;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    padding: 9px;
    text-align: center;
    line-height: 1.2;
  }

  .choice-button.selected {
    background: #eafffb;
    color: #2d8578;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .segmented button {
    min-height: 42px;
    border-radius: 8px;
    background: #6f8ee8;
    color: #ffffff;
    font-weight: 900;
  }

  .segmented .selected {
    background: #eafffb;
    color: #2d8578;
  }

  .bottom-nav {
    position: sticky;
    bottom: -78px;
    z-index: 5;
    min-height: 66px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    margin: auto -4px -72px;
    padding: 8px;
    background: #5d7bd3;
    border-radius: 12px 12px 0 0;
  }

  .bottom-nav button {
    display: grid;
    place-items: center;
    gap: 4px;
    background: transparent;
    color: #dbe7ff;
    font-size: 11px;
    font-weight: 900;
  }

  .bottom-nav button svg {
    width: 19px;
    height: 19px;
    display: block;
  }

  .bottom-nav .active {
    color: #71f2d3;
  }

  /* MedSense.jsx visual overrides */
  .app-backdrop {
    background: var(--bg);
  }

  .phone-shell {
    width: min(100%, 420px);
    color: var(--text);
    background: var(--bg);
  }

  .status-bar,
  .brand-copy,
  .center-screen p,
  .auth-screen > p,
  .role-screen > p,
  .medicine-card p,
  .medicine-card small,
  .medicine-ticket small,
  .review-card p,
  .empty-state p,
  .app-header small {
    color: var(--text2);
  }

  .pill-logo {
    width: 64px;
    height: 64px;
    background: none;
    box-shadow: none;
    transform: none;
    position: relative;
  }

  .pill-logo::before {
    content: "";
    position: absolute;
    left: 13px;
    top: 20px;
    width: 38px;
    height: 22px;
    border-radius: 999px;
    transform: rotate(-45deg);
    background: linear-gradient(90deg, #ffffff 0 50%, var(--teal) 50% 100%);
    box-shadow: 0 12px 28px rgba(0, 212, 170, 0.24);
  }

  .primary {
    background: var(--teal);
    color: var(--bg);
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }

  .primary:hover {
    background: var(--teal2);
  }

  .secondary,
  .role-card,
  input,
  select,
  textarea,
  .consent,
  .medicine-card,
  .review-card,
  .profile-card,
  .empty-state,
  .medicine-ticket,
  .admin-review,
  .admin-summary span,
  .mini-summary span,
  .choice-button,
  .chip,
  .segmented button,
  .bottom-nav {
    background: var(--card);
    border-color: var(--border);
    color: var(--text);
  }

  input,
  select,
  textarea,
  .choice-button,
  .chip,
  .segmented button,
  .consent,
  .admin-summary span,
  .mini-summary span {
    background: var(--card2);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text3);
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--teal);
    box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.16);
  }

  .link-button,
  .back-link,
  .tiny-button,
  .review-card span,
  .profile-card span,
  .eyebrow,
  .bottom-nav .active {
    color: var(--teal);
  }

  .dots span {
    background: var(--border);
  }

  .dots .active {
    background: var(--teal);
  }

  .walk-icon {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    background: var(--card);
    border: 1px solid var(--border);
    margin-bottom: 22px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }

  .walk-icon::before {
    content: "";
    display: block;
  }

  .meds-icon::before {
    width: 38px;
    height: 22px;
    border-radius: 999px;
    transform: rotate(-45deg);
    background: linear-gradient(90deg, #ffffff 0 50%, var(--teal) 50% 100%);
  }

  .ask-icon::before {
    width: 34px;
    height: 28px;
    border-radius: 14px 14px 14px 5px;
    background: var(--teal);
  }

  .alert-icon {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    background: var(--card);
    border: 1px solid var(--border);
  }

  .alert-icon::before {
    content: "";
    display: block;
    width: 34px;
    height: 34px;
    border-radius: 50% 50% 8px 8px;
    background: var(--orange);
  }

  .alert-icon::after {
    display: none;
  }

  .role-card.selected,
  .medicine-ticket.selected {
    border-color: var(--teal);
    background: rgba(0,212,170,0.07);
  }

  .today-card {
    background: linear-gradient(135deg, rgba(0,212,170,0.12), rgba(59,130,246,0.12));
    border: 1px solid rgba(0,212,170,0.35);
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }

  .today-card span,
  .today-card p {
    color: var(--text2);
  }

  .today-card b,
  .choice-button.selected,
  .chip.selected,
  .segmented .selected {
    background: var(--teal);
    color: var(--bg);
  }

  .warning-card {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
  }

  .warning-card span {
    border-bottom-color: var(--red);
  }

  .ok,
  .status-reviewed,
  .medicine-ticket b.status-reviewed {
    background: #064e3b;
    color: #d1fae5;
    border: 1px solid #34d399;
  }

  .pending,
  .status-pending,
  .medicine-ticket b.status-pending {
    background: rgba(245,158,11,0.15);
    color: var(--orange);
  }

  .error {
    background: rgba(239,68,68,0.14);
    border: 1px solid rgba(239,68,68,0.32);
    color: #fecdd3;
  }

  .screen-copy {
    color: var(--text2);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    text-align: center;
    margin-bottom: 10px;
  }

  .condition-picker,
  .checkin-card {
    border: 0;
    display: grid;
    gap: 9px;
    margin: 0;
    padding: 0;
  }

  .checkin-list {
    display: grid;
    gap: 12px;
  }

  .condition-picker legend {
    color: var(--text2);
    font-size: 11px;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
  }

  .checkin-card legend {
    color: var(--text2);
    font-size: 12px;
    font-weight: 900;
    line-height: 1.35;
    text-align: left;
    text-transform: uppercase;
  }

  .checkin-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    gap: 12px;
    padding: 16px;
  }

  .checkin-question {
    color: var(--text);
    font-size: 13px;
    font-weight: 900;
    line-height: 1.45;
    margin: 0;
    text-align: left;
  }

  .checkin-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
    gap: 8px;
  }

  .condition-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .mini-chip {
    min-height: 30px;
    border-radius: 999px;
    background: var(--card2);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 11px;
    font-weight: 900;
    padding: 0 11px;
  }

  .checkin-options .mini-chip {
    width: 100%;
    min-height: 38px;
    border-radius: 8px;
    padding: 8px 10px;
    text-align: center;
    white-space: normal;
  }

  .mini-chip.active {
    background: var(--teal);
    border-color: var(--teal);
    color: var(--bg);
  }

  .medicine-card.compact {
    min-height: 64px;
  }

  .success-orb {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(0,212,170,0.15);
    color: var(--teal);
    font-size: 24px;
    font-weight: 900;
    margin-bottom: 16px;
  }

  .submitted-screen {
    gap: 8px;
  }

  .advice-card,
  .plan-card {
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    text-align: left;
    margin: 8px 0;
  }

  .advice-card strong,
  .advice-card span,
  .plan-card strong,
  .plan-card p,
  .plan-card b {
    display: block;
  }

  .advice-card span,
  .plan-card p {
    color: var(--text2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.5;
    margin-top: 6px;
  }

  .plan-card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: start;
  }

  .plan-card.recommended {
    border-color: var(--teal);
    background: rgba(0,212,170,0.07);
  }

  .plan-card b {
    color: var(--teal);
    font-size: 12px;
    white-space: nowrap;
  }

  .action-card {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .screen-section {
    display: grid;
    gap: 6px;
  }

  .screen-section h1 {
    font-size: 24px;
    margin-bottom: 0;
  }

  @media (min-width: 760px) {
    .app-backdrop {
      align-items: start;
      padding: 32px;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) 0 0 / 48px 48px,
        linear-gradient(180deg, #0a0f1e 0%, #0d1426 100%);
    }

    .phone-shell {
      width: min(100%, 1180px);
      min-height: calc(100vh - 64px);
      max-height: none;
      overflow: visible;
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
    }

    .auth-shell {
      width: min(100%, 520px);
      min-height: auto;
      align-self: center;
      padding: 38px;
    }

    .auth-shell .center-screen {
      min-height: 560px;
    }

    .auth-shell .auth-screen {
      padding-top: 0;
    }

    .patient-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      grid-auto-rows: min-content;
      gap: 18px 24px;
      padding-bottom: 28px;
    }

    .patient-shell > .app-header,
    .patient-shell > .error {
      grid-column: 1 / -1;
    }

    .patient-shell > .bottom-nav {
      grid-column: 1;
      grid-row: 2 / span 20;
      align-self: start;
    }

    .patient-shell > :not(.app-header):not(.error):not(.bottom-nav) {
      grid-column: 2;
    }

    .patient-shell .today-card {
      min-height: 150px;
    }

    .patient-shell .medicine-list {
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .patient-shell .form-screen,
    .patient-shell .center-screen {
      width: min(100%, 760px);
      justify-self: center;
    }

    .patient-shell .form-screen .medicine-list {
      grid-template-columns: 1fr;
    }

    .bottom-nav {
      position: sticky;
      top: 110px;
      bottom: auto;
      min-height: 0;
      grid-template-columns: 1fr;
      align-content: start;
      gap: 8px;
      margin: 0;
      padding: 12px;
      border-radius: 14px;
    }

    .bottom-nav button {
      min-height: 46px;
      grid-template-columns: 24px 1fr;
      place-items: center start;
      padding: 0 10px;
      border-radius: 8px;
      text-align: left;
    }

    .bottom-nav .active {
      background: rgba(0, 212, 170, 0.08);
    }

    .admin-shell {
      display: grid;
      grid-template-columns: minmax(280px, 390px) minmax(0, 1fr);
      grid-auto-rows: min-content;
      gap: 18px 24px;
      padding-bottom: 28px;
    }

    .admin-shell > .app-header,
    .admin-shell > .error {
      grid-column: 1 / -1;
    }

    .admin-shell > .screen-section,
    .admin-shell > .queue-list {
      grid-column: 1;
    }

    .admin-shell > .admin-review {
      grid-column: 2;
      grid-row: 2 / span 3;
      align-self: start;
      margin-top: 0;
      padding: 20px;
    }

    .admin-shell .mini-summary {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .admin-shell .chip-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .patient-shell .choice-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .app-header {
      align-items: center;
      margin-bottom: 4px;
    }

    .app-header h1 {
      font-size: 30px;
    }
  }

  @media (max-width: 759px) {
    .app-backdrop {
      padding: 0;
      display: block;
    }

    .phone-shell {
      width: 100%;
      min-height: 100vh;
      max-height: none;
      overflow: visible;
      padding: 18px 16px 86px;
      border-radius: 0;
    }

    .center-screen {
      min-height: calc(100vh - 120px);
    }

    .bottom-nav {
      position: sticky;
      bottom: 0;
      margin: auto -8px -78px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
  }
`;

export default App;
