import { useEffect } from "react";
export default function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="ui-toast" role="status">
      {message}
    </div>
  );
}
