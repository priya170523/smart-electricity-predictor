# ⚡ AI-Based Smart Electricity Consumption Predictor and Energy Optimization System

A full-stack web application that helps users monitor electricity consumption, analyze historical usage, predict future energy requirements using Machine Learning, estimate electricity expenses, and explore energy-saving recommendations.

## 📌 1. Project Overview

Electricity consumption is an important concern for households because excessive usage can increase electricity bills and waste energy. Understanding historical consumption patterns can help users make better decisions about their electricity usage.

The **AI-Based Smart Electricity Consumption Predictor and Energy Optimization System** provides a web-based solution for recording electricity consumption, visualizing historical usage, generating ML-based predictions, estimating electricity bills, and presenting energy-saving recommendations.

The application combines a React frontend, a Node.js and Express backend, MongoDB for data storage, and Python for Machine Learning operations.

## 🎯 2. Project Objectives

- Monitor and record monthly electricity consumption.
- Maintain historical electricity consumption records.
- Predict electricity consumption using Machine Learning.
- Visualize electricity usage and consumption trends.
- Estimate electricity bills based on consumption.
- Provide energy-saving recommendations.
- Implement secure user authentication.
- Deploy the application online for convenient access.

## ✨ 3. Key Features

### 🔐 User Authentication
- User registration and login.
- Password hashing using bcryptjs.
- Token-based authentication using JSON Web Tokens (JWT).
- Authentication middleware for protected API endpoints.

### ⚡ Electricity Consumption Management
- Record monthly electricity consumption.
- Store and retrieve consumption records.
- Analyze historical electricity usage.
- Display consumption information through the dashboard.

### 🤖 Machine Learning Prediction
- Retrieve electricity consumption data.
- Process historical consumption records.
- Execute the Python prediction script.
- Generate electricity consumption predictions.
- Display prediction results in the web application.

### 📊 Data Visualization
- Visualize historical consumption patterns.
- Compare actual and predicted consumption where supported.
- Display electricity usage information using charts.

### 🌱 Energy Optimization
- Display energy-saving recommendations.
- Help users understand consumption patterns.
- Encourage efficient electricity usage.

### ☁️ Online Deployment
- React frontend hosted on Vercel.
- Node.js backend hosted on Render.
- MongoDB Atlas used for cloud database storage.

## 🛠️ 4. Technologies Used

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Vite | Frontend development and build tool |
| JavaScript | Application development |
| Node.js | Backend JavaScript runtime |
| Express.js | REST API development |
| MongoDB Atlas | Cloud database |
| Mongoose | MongoDB object modeling |
| Python | Machine Learning implementation |
| scikit-learn | Machine Learning utilities |
| NumPy | Numerical computation |
| Joblib | Saving and loading ML models |
| bcryptjs | Password hashing |
| JSON Web Token (JWT) | Authentication |
| Docker | Backend deployment environment |
| Git | Version control |
| GitHub | Source code hosting |
| Vercel | Frontend hosting |
| Render | Backend hosting |

## 🏗️ 5. System Architecture

```text
                       USER
                         |
                         v
              +----------------------+
              |   React + Vite       |
              |   Frontend           |
              |      (Vercel)        |
              +----------------------+
                         |
                         | HTTP API Requests
                         v
              +----------------------+
              |   Node.js + Express  |
              |   Backend (Render)   |
              +----------------------+
                    |           |
                    |           |
                    v           v
          +----------------+  +------------------+
          | MongoDB Atlas  |  | Python ML Script |
          | User and       |  | Data Processing  |
          | Consumption    |  | and Prediction   |
          | Records        |  +------------------+
          +----------------+           |
                                       v
                              +------------------+
                              | Prediction Result|
                              +------------------+
                                       |
                                       v
                              Frontend Dashboard
```

### System Workflow

1. The user opens the web application.
2. The user registers or logs in.
3. The frontend communicates with the backend through HTTP API requests.
4. The backend authenticates requests and interacts with MongoDB.
5. Electricity consumption records are retrieved or stored.
6. When a prediction is requested, the backend executes the Python ML script.
7. The Python script processes the available consumption data and generates a prediction.
8. The backend returns the result to the frontend.
9. The dashboard displays the prediction and available consumption analysis.

## 📂 6. Project Structure

```text
smart-electricity-predictor/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── ActualVsPredictedChart.jsx
│   │   ├── Auth.jsx
│   │   ├── Auth.css
│   │   ├── ConsumptionForm.jsx
│   │   ├── EnergyRecommendations.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Consumption.js
│   │   └── User.js
│   ├── routes/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
│
├── ml/
│   ├── models/
│   │   └── electricity_model.pkl
│   ├── requirements.txt
│   └── train_model.py
│
├── scripts/
│   └── seed-consumption.js
│
├── Dockerfile
├── .dockerignore
├── .gitignore
└── README.md
```

*Note: This tree highlights the main application files. Some backup, configuration, and generated files have been omitted.*

## ⚙️ 7. Installation and Setup

### Prerequisites

Install the following software:

- Git
- Node.js and npm
- Python 3
- A MongoDB Atlas account or compatible MongoDB instance

### Step 1: Clone the Repository

```bash
git clone https://github.com/priya170523/smart-electricity-predictor.git
cd smart-electricity-predictor
```

### Step 2: Configure the Backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory.

Example configuration:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_private_jwt_secret
```

Replace the example values with your own configuration. Keep credentials private and never commit secrets to GitHub.

### Step 3: Configure the Machine Learning Environment

Return to the project root:

```bash
cd ..
python3 -m venv ml/venv
source ml/venv/bin/activate
```

Install the Python dependencies:

```bash
pip install -r ml/requirements.txt
```

The ML script and model files should remain in their expected project locations.

### Step 4: Configure the Frontend

Open a separate terminal and run:

```bash
cd ~/smart-electricity-predictor/client
npm install
```

Configure the frontend API URL using the environment variable expected by the application.

Example:

```env
VITE_API_URL=http://localhost:5001
```

The URL must match the backend address and API configuration used by the application.

### Step 5: Start the Backend

In a terminal:

```bash
cd ~/smart-electricity-predictor/server
node server.js
```

Confirm that the server starts successfully and connects to MongoDB.

### Step 6: Start the Frontend

In a separate terminal:

```bash
cd ~/smart-electricity-predictor/client
npm run dev
```

Open the local URL printed by Vite in your browser.

**Note:** The environment variables, port numbers, and startup instructions must match your actual configuration. If your application uses additional required environment variables, configure those as well.

## 🌐 8. Deployment

The application uses the following services:

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | MongoDB Atlas |
| Source Code | GitHub |

### Deployment Process

1. Push the source code to GitHub.
2. Connect the frontend project to Vercel.
3. Configure the backend service on Render.
4. Configure the MongoDB connection and authentication secrets securely.
5. Set the frontend API URL to the deployed backend address.
6. Configure the ML environment and Python dependencies on the backend.
7. Deploy the application and test the authentication, consumption APIs, and prediction endpoint.

### Production Configuration

The deployed frontend must communicate with the deployed backend rather than a local development server.

The Python ML script must also use the appropriate production API configuration when it retrieves consumption records.

Never publish database credentials, JWT secrets, access tokens, or private environment files.

## 🔒 9. Security Considerations

- Hash user passwords before storing them.
- Protect private API endpoints with authentication middleware.
- Keep database credentials and authentication secrets private.
- Validate and sanitize incoming user data.
- Apply authorization checks when accessing user-specific consumption records.
- Exclude environment files containing secrets from Git tracking.
- Use HTTPS for communication with deployed services.

## 🚀 10. Future Enhancements

The following improvements could be added in future versions:

- Improve prediction accuracy using larger, reliable datasets.
- Evaluate and compare different Machine Learning algorithms.
- Introduce real-time electricity monitoring.
- Add appliance-level consumption analysis.
- Provide personalized energy-saving recommendations.
- Generate downloadable electricity consumption reports.
- Introduce alerts for unusually high consumption.
- Improve mobile responsiveness and accessibility.
- Add more detailed prediction evaluation metrics.

## 🎓 11. Project Information

**Project Title:** AI-Based Smart Electricity Consumption Predictor and Energy Optimization System

**Domain:** Machine Learning and Full-Stack Web Development

**Frontend:** React.js and Vite

**Backend:** Node.js and Express.js

**Database:** MongoDB Atlas

**Machine Learning:** Python and scikit-learn

**Deployment:** Vercel and Render

## 👩‍💻 12. Author and Repository

**GitHub Profile:** [priya170523](https://github.com/priya170523)

**Project Repository:** [Smart Electricity Predictor](https://github.com/priya170523/smart-electricity-predictor)

---

⭐ If you find this project useful, consider starring the repository!