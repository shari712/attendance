import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full text-center p-8">
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Intelligent Face Authentication <br />
          <span className="text-blue-600">& Attendance System</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          AI-powered automated attendance with real-time security alerts and parent notifications.
        </p>
        <div className="flex justify-center">
          <Link
            to="/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Login to Portal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
