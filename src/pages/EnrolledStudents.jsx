import { useEffect, useState } from "react";
import { db } from "../src/firebase";
import { collection, getDocs, query } from "firebase/firestore";

import "./Admin.css";

const EnrolledStudents = () => {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const fetchStudents = async () => {
      const q = query(collection(db, "scholarshipApplications"));

      const snapshot = await getDocs(q);

      const enrolled = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((student) => student.status === "Enrolled");

      setStudents(enrolled);
    };

    fetchStudents();
  }, []);

  return (
    <main className="admin-page">
      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Enrolled Students</h1>
          <p>
            Students who have completed registration and have been admitted.
          </p>
        </div>
      </section>

      <section className="admin-table-card">
        <h2>Total Enrolled: {students.length}</h2>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Track</th>
                <th>Method</th>
                <th>Location</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td data-label="Name">{student.fullName}</td>
                  <td data-label="Email">{student.email}</td>
                  <td data-label="WhatsApp">{student.whatsapp}</td>
                  <td data-label="Track">{student.track}</td>
                  <td data-label="Method">{student.learningMethod}</td>
                  <td data-label="Location">{student.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default EnrolledStudents;
