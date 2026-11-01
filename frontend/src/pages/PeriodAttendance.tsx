import React, { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  Sparkles,
  Info
} from 'lucide-react';

interface TimetableSlot {
  id: string;
  class_id: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  subjects?: { name: string; code: string };
  staff?: { name: string };
}

interface RecognitionEvent {
  id: string;
  student_name: string;
  time: string;
  type: 'Check-in' | 'Unauthorized' | 'Already Noted';
  status: 'Verified' | 'Error' | 'Info';
}

const PeriodAttendance: React.FC = () => {
  // FIX 1: Provide dummy data so the scanner doesn't abort if the backend API fails
  const [timetable, setTimetable] = useState<TimetableSlot[]>([
    {
      id: 'dummy-slot-1',
      class_id: 'class-1',
      day: 'Today',
      period_number: 1,
      start_time: '09:00',
      end_time: '10:00',
      subjects: { name: 'Test Subject', code: 'TST101' },
      staff: { name: 'Test Teacher' }
    }
  ]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('dummy-slot-1');
  const [isLoading, setIsLoading] = useState(true);

  // Face-API States
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);

  // Camera & Event state
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  
  // Real-time tracking and Popups
  const presentStudentsRef = useRef<Set<string>>(new Set());
  const [attendanceLog, setAttendanceLog] = useState<string[]>([]);
  const [popupMsg, setPopupMsg] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const scanLockRef = useRef<boolean>(false);

  // Define student folders (must match public/students/...)
  const students = ['student1', 'student2', 'student3'];
  const NUM_SAMPLES_PER_STUDENT = 3;

  useEffect(() => {
    const fetchTimetable = async () => {
      setIsLoading(true);
      try {
        const slots = await api.get('/timetable/');
        if (slots && slots.length > 0) {
          setTimetable(slots);
          setSelectedSlotId(slots[0].id);
        }
      } catch (err) {
        console.warn('Backend API failed, using dummy timetable data for testing.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimetable();
  }, []);

  useEffect(() => {
    const loadModelsAndData = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);

        const labeledDescriptors = await Promise.all(
          students.map(async (student) => {
            const descriptions: Float32Array[] = [];
            for (let i = 1; i <= NUM_SAMPLES_PER_STUDENT; i++) {
              try {
                const img = await faceapi.fetchImage(`/students/${student}/${i}.jpeg`);
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (detection) descriptions.push(detection.descriptor);
              } catch (err) {
                console.warn(`Could not load /students/${student}/${i}.jpeg`);
              }
            }
            return descriptions.length > 0 
              ? new faceapi.LabeledFaceDescriptors(student, descriptions) 
              : null;
          })
        );

        const validDescriptors = labeledDescriptors.filter((desc): desc is faceapi.LabeledFaceDescriptors => desc !== null);
        
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.6));
        } else {
          console.error("No valid student images found in the public/students folder!");
        }
        
        setIsModelLoaded(true);
      } catch (error) {
        console.error("Error loading face-api models:", error);
      }
    };
    loadModelsAndData();
  }, []);

  const activeSlot = timetable.find((s) => s.id === selectedSlotId);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (err) {
      alert('Unable to access webcam. Please check browser permissions.');
      console.error(err);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsWebcamActive(false);
      setIsAutoScanning(false);
    }
  };

  const showPopup = (text: string, type: 'error' | 'info') => {
    setPopupMsg({ text, type });
    setTimeout(() => setPopupMsg(null), 3500);
  };

  const logEvent = (name: string, type: 'Check-in' | 'Unauthorized' | 'Already Noted', status: 'Verified' | 'Error' | 'Info') => {
    const newEvent: RecognitionEvent = {
      id: Math.random().toString(),
      student_name: name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      status,
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  const handlePerformScan = async () => {
    console.log("Scanner triggered..."); // Debug Log
    
    if (scanLockRef.current) return;
    if (!faceMatcher) {
      console.log("Face matcher not loaded yet.");
      return;
    }
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      console.log("Video feed not ready.");
      return;
    }

    scanLockRef.current = true;

    try {
      console.log("Analyzing video frame..."); // Debug Log
      const detections = await faceapi.detectAllFaces(videoRef.current as any)
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log(`Found ${detections.length} faces in frame.`); // Debug Log

      if (detections.length > 0) {
        let foundUnknown = false;

        for (const detection of detections) {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          console.log("Match result:", bestMatch.toString()); // Debug Log
          
          if (bestMatch.label !== 'unknown') {
            const studentName = bestMatch.label;

            if (presentStudentsRef.current.has(studentName)) {
              showPopup(`${studentName.toUpperCase()} is already noted!`, 'info');
            } else {
              presentStudentsRef.current.add(studentName);
              setAttendanceLog(Array.from(presentStudentsRef.current));
              logEvent(studentName.toUpperCase(), 'Check-in', 'Verified');
              await submitToExistingBackend(studentName);
            }
          } else {
            foundUnknown = true;
          }
        }

        if (foundUnknown) {
          showPopup('Alert: Unauthorized person detected!', 'error');
          logEvent('Unknown Person', 'Unauthorized', 'Error');
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
    } finally {
      scanLockRef.current = false;
    }
  };

  const submitToExistingBackend = async (studentName: string) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const { supabase } = await import('../lib/supabase');
      const session = await supabase.auth.getSession();

      await fetch(`${baseUrl}/api/attendance/mark-frontend/${selectedSlotId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ student_identifier: studentName }),
      });
    } catch (err: any) {
      console.error('Backend sync failed:', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoScanning && isWebcamActive && isModelLoaded) {
      interval = setInterval(() => {
        handlePerformScan();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAutoScanning, isWebcamActive, isModelLoaded]);

  if (isLoading || !isModelLoaded) {
    return (
      <div className="p-16 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span className="text-xs">{!isModelLoaded ? 'Loading AI Face Models...' : 'Loading timetable slots...'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Live Facial Attendance</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              Continuous Scan Active
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated facial recognition scanner. Walks-ins are marked automatically.
          </p>
        </div>
      </div>

      {popupMsg && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl font-bold text-white flex items-center gap-2 animate-bounce ${popupMsg.type === 'error' ? 'bg-red-600' : 'bg-yellow-500'}`}>
          {popupMsg.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />}
          {popupMsg.text}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="w-full lg:w-1/3">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Select Period Slot *</label>
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {timetable.map((slot) => (
              <option key={slot.id} value={slot.id}>
                Period {slot.period_number} [{slot.day}]
              </option>
            ))}
          </select>
        </div>

        {activeSlot && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/70 w-full lg:w-auto">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Subject</span>
              <span className="font-mono font-bold text-slate-800">{activeSlot.subjects?.code || 'CS301'}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Faculty</span>
              <span className="font-medium text-slate-800">{activeSlot.staff?.name || 'Faculty Member'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Camera size={18} className="text-blue-600" />
                <span>Live Camera Feed</span>
              </h3>
              <div className="flex items-center gap-2">
                {!isWebcamActive ? (
                  <button onClick={startWebcam} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                    Turn On Camera
                  </button>
                ) : (
                  <button onClick={stopWebcam} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    Turn Off Camera
                  </button>
                )}
              </div>
            </div>

            <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border-2 border-slate-800">
              
              {/* FIX 2: Explicit width/height added to video so face-api can read dimensions */}
              <video 
                ref={videoRef} 
                width="640"
                height="480"
                className={`w-full h-full object-cover transform scale-x-[-1] ${!isWebcamActive ? 'hidden' : ''}`} 
                autoPlay 
                muted 
                playsInline 
              />
              
              {isWebcamActive && isAutoScanning && (
                <div className="absolute inset-0 bg-blue-500/10 z-10 pointer-events-none">
                   <div className="w-full h-0.5 bg-blue-400 absolute top-0 animate-[ping_2s_ease-in-out_infinite]"></div>
                </div>
              )}

              {!isWebcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                  <Camera size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Camera is Offline</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles size={14} className={isAutoScanning ? "text-green-500 animate-pulse" : "text-slate-400"} />
              <span>{isAutoScanning ? "Scanner Actively Monitoring" : "Scanner Paused"}</span>
            </div>

            <button
              onClick={() => setIsAutoScanning(!isAutoScanning)}
              disabled={!isWebcamActive}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-40 transition-all flex items-center gap-2 ${isAutoScanning ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-green-600 hover:bg-green-700 shadow-green-500/20'}`}
            >
              <UserCheck size={14} />
              <span>{isAutoScanning ? "Stop Continuous Scan" : "Start Continuous Scan"}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 max-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" />
                <span>Live Event Log</span>
              </h3>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
              {events.length === 0 ? (
                <p className="text-slate-400 text-xs text-center mt-10">Waiting for students...</p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className={`p-3 border rounded-xl flex items-center justify-between text-xs ${ev.status === 'Error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${ev.status === 'Error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {ev.status === 'Error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{ev.student_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ev.time}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${ev.status === 'Error' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {ev.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm mb-4 border-b border-slate-700 pb-2">Currently Present ({attendanceLog.length})</h3>
            <div className="flex flex-wrap gap-2">
              {attendanceLog.length === 0 ? (
                <span className="text-slate-500 text-xs">No one marked present.</span>
              ) : (
                attendanceLog.map((name, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-emerald-400">
                    {name.toUpperCase()}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodAttendance;