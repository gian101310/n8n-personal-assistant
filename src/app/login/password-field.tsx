"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="passwordField">
      <LockKeyhole size={18} />
      <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="passwordToggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
