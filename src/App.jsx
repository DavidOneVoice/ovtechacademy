import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Scholarship from "./pages/Scholarship";
import Admin from "./pages/Admin";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scholarship" element={<Scholarship />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
