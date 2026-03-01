import React from 'react';
import './header.css';

export default function Header({ user, onLogout, onOpenReminders }) {
  return (
    <div className="app-topbar">
      <div className="brand">
        <div className="logo" />
        <h2>MediTrack</h2>
      </div>

      <div className="header-right">
        <div className="user-info">Practitioner: {user?.name}</div>
        <button className="header-btn" onClick={onOpenReminders}>🔔 Reminders</button>
        <button className="header-btn" onClick={onLogout}>Logout</button>
      </div>
    </div>
  )
}
