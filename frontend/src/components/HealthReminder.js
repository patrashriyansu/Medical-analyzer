import React, { useState, useEffect } from "react";
import "./HealthReminder.css";

function HealthReminder({ isOpen, onClose }) {
  const [reminders, setReminders] = useState([]);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("reminders");
      if (saved) setReminders(JSON.parse(saved));
    }
  }, [isOpen]);

  const addReminder = () => {
    if (title && time) {
      const reminder = { id: Date.now(), time, title, description };
      const updated = [...reminders, reminder];
      setReminders(updated);
      localStorage.setItem("reminders", JSON.stringify(updated));
      setTime("");
      setTitle("");
      setDescription("");
    }
  };

  const deleteReminder = (id) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    localStorage.setItem("reminders", JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div className="reminder-overlay" onClick={onClose}>
      <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reminder-header">
          <h2>Health Reminders</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="reminder-form">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="Time"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reminder Title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows="2"
          />
          <button onClick={addReminder} className="add-btn">Add Reminder</button>
        </div>

        <div className="reminders-list">
          {reminders.length === 0 ? (
            <p>No reminders yet</p>
          ) : (
            reminders.map(r => (
              <div key={r.id} className="reminder-item">
                <strong>{r.time}</strong> - {r.title}
                <button onClick={() => deleteReminder(r.id)} className="delete-btn">Delete</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default HealthReminder;
