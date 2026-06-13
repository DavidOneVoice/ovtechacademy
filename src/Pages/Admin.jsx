import { useEffect, useState } from "react";
import "./Admin.css";
import { db } from "../src/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

const Admin = () => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const fetchApplications = async () => {
      const q = query(
        collection(db, "scholarshipApplications"),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setApplications(data);
    };

    fetchApplications();
  }, []);

  const total = applications.length;
  const pending = applications.filter((app) => app.status === "Pending").length;
  const approved = applications.filter(
    (app) => app.status === "Approved",
  ).length;
  const rejected = applications.filter(
    (app) => app.status === "Rejected",
  ).length;

  return (
    <main className="admin-page">
      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Scholarship Applications</h1>
          <p>
            Review and manage scholarship applications submitted by learners.
          </p>
        </div>

        <a href="/" className="admin-home-btn">
          Back to Website
        </a>
      </section>

      <section className="admin-stats">
        <div>
          <h3>{total}</h3>
          <p>Total Applications</p>
        </div>

        <div>
          <h3>{pending}</h3>
          <p>Pending</p>
        </div>

        <div>
          <h3>{approved}</h3>
          <p>Approved</p>
        </div>

        <div>
          <h3>{rejected}</h3>
          <p>Rejected</p>
        </div>
      </section>

      <section className="admin-table-card">
        <h2>Recent Applications</h2>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>WhatsApp</th>
                <th>Track</th>
                <th>Method</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong>{app.fullName}</strong>
                    <small>{app.email}</small>
                  </td>
                  <td>{app.whatsapp}</td>
                  <td>{app.track}</td>
                  <td>{app.learningMethod}</td>
                  <td>{app.location}</td>
                  <td>
                    <span className="admin-status">{app.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {applications.length === 0 && (
            <p className="admin-empty">No applications submitted yet.</p>
          )}
        </div>
      </section>
    </main>
  );
};

export default Admin;
