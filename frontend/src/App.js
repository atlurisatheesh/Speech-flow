import { useState } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainApp from '@/components/MainApp';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
