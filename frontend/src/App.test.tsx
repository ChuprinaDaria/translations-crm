// Temporary test file to check if React is working
import { createRoot } from "react-dom/client";

function TestApp() {
  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
      <h1>Test App - React is working!</h1>
      <p>If you see this, React is rendering correctly.</p>
    </div>
  );
}

// Uncomment to test
// const root = document.getElementById("root");
// if (root) {
//   createRoot(root).render(<TestApp />);
// }

