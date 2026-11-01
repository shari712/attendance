import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  Sparkles,
  Info,
  Play,
  Square,
  RefreshCw
} from 'lucide-react';

interface TimetableSlot {
  id: string;
  class_id?: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  subjects?: { name: string; code: string };
  staff?: { name: string };
}

interface StudentRecord {
  id: string;
  name: string;
  register_number: string;
  email?: string;
}

interface RecognitionEvent {
  id: string;
  student_name: string;
  time: string;
  type: 'Check-in' | 'Unauthorized' | 'Already Noted';
  status: 'Verified' | 'Error' | 'Info';
}

const PeriodAttendance: React.FC = () => {
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [availableStudents, setAvailableStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Face-API States
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing facial recognition neural networks...');
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);

  // Camera & Detection state
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  
  // Real-time tracking
  const presentStudentsRef = useRef<Set<string>>(new Set());
  const [attendanceLog, setAttendanceLog] = useState<string[]>([]);
  const [popupMsg, setPopupMsg] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);
  const scanLockRef = useRef<boolean>(false);

  // Pre-loaded student sample directories in public/students
  const studentKeys = ['student1', 'student2', 'student3', 'student4'];
  const NUM_SAMPLES_PER_STUDENT = 10;

  // 1. Fetch live timetable and students list from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch timetable directly from Supabase
        const { data: dbSlots } = await supabase
          .from('timetable')
          .select('id, class_id, day, period_number, start_time, end_time, room, subjects(name, code), staff(name)')
          .order('period_number', { ascending: true });

        if (dbSlots && dbSlots.length > 0) {
          setTimetable(dbSlots as any);
          setSelectedSlotId(dbSlots[0].id);
        } else {
          // Fallback to API if available
          const apiSlots = await api.get('/timetable/').catch(() => []);
          if (apiSlots && apiSlots.length > 0) {
            setTimetable(apiSlots);
            setSelectedSlotId(apiSlots[0].id);
          } else {
            // Default slot if none found
            const fallbackSlot: TimetableSlot = {
              id: 'slot-default',
              day: 'Today',
              period_number: 1,
              start_time: '09:00',
              end_time: '10:00',
              subjects: { name: 'Advanced Java Programming (AJP)', code: '23CI501' },
              staff: { name: 'Mr. K.A. Dhamotharan' }
            };
            setTimetable([fallbackSlot]);
            setSelectedSlotId(fallbackSlot.id);
          }
        }

        // Fetch students from Supabase
        const { data: studentList } = await supabase
          .from('students')
          .select('id, name, register_number, email');

        if (studentList && studentList.length > 0) {
          setAvailableStudents(studentList);
        }
      } catch (err) {
        console.warn('Timetable / student fetch notice:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Load face-api.js weights and build face matcher
  useEffect(() => {
    const loadModelsAndData = async () => {
      try {
        setLoadingStatus('Loading SSD MobileNet, Face Landmarks & Recognition Models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);

        setLoadingStatus('Analyzing registered student face reference encodings...');
        const labeledDescriptors = await Promise.all(
          studentKeys.map(async (student) => {
            const descriptions: Float32Array[] = [];
            for (let i = 1; i <= NUM_SAMPLES_PER_STUDENT; i++) {
              try {
                const img = await faceapi.fetchImage(`/students/${student}/${i}.jpeg`);
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (detection) descriptions.push(detection.descriptor);
              } catch (err) {
                // Ignore missing sample images
              }
            }
            return descriptions.length > 0 
              ? new faceapi.LabeledFaceDescriptors(student, descriptions) 
              : null;
          })
        );

        const validDescriptors = labeledDescriptors.filter((desc): desc is faceapi.LabeledFaceDescriptors => desc !== null);
        
        if (validDescriptors.length > 0) {
          // Distance threshold: 0.45 (strict threshold to prevent cross-matching between students)
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.45));
        }

        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading face-api models:', error);
        setIsModelLoaded(true); // Allow manual marking even if WebGL fails
      }
    };

    loadModelsAndData();
  }, []);

  const activeSlot = timetable.find((s) => s.id === selectedSlotId);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (err) {
      alert('Unable to access webcam. Please check your browser camera permissions.');
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
      setDetectedFacesCount(0);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const showPopup = (text: string, type: 'error' | 'info' | 'success') => {
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

  // 3. Mark attendance in Supabase database
  const markAttendanceInDatabase = async (studentKey: string, specificStudent?: StudentRecord) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      let targetStudent = specificStudent;
      if (!targetStudent) {
        let regNo = '';
        if (studentKey === 'student1') regNo = 'ES24CJ12'; // Harshini S
        else if (studentKey === 'student2') regNo = 'ES24CJ15'; // Pooja Sri A
        else if (studentKey === 'student3') regNo = 'ES24CJ08'; // Dharani S
        else if (studentKey === 'student4' || studentKey.toLowerCase().includes('lalitha') || studentKey.toLowerCase().includes('lathika')) regNo = 'ES24CJ17'; // Lalitha Shree
        else if (studentKey === 'student5') regNo = 'STU001'; // Test Student

        if (availableStudents.length > 0 && regNo) {
          targetStudent = availableStudents.find(s => s.register_number === regNo);
        }
        if (!targetStudent && regNo) {
          const { data: sRow } = await supabase
            .from('students')
            .select('id, name, register_number, email')
            .eq('register_number', regNo)
            .maybeSingle();
          if (sRow) targetStudent = sRow;
        }
        if (!targetStudent && availableStudents.length > 0) {
          targetStudent = availableStudents[0];
        }
      }

      const studentNameDisplay = targetStudent ? `${targetStudent.name} (${targetStudent.register_number})` : studentKey.toUpperCase();
      const studentId = targetStudent?.id;

      let slotId = selectedSlotId;
      if (!slotId || slotId === 'slot-default') {
        if (timetable.length > 0 && timetable[0].id !== 'slot-default') {
          slotId = timetable[0].id;
        } else {
          const { data: firstSlot } = await supabase
            .from('timetable')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (firstSlot?.id) {
            slotId = firstSlot.id;
          }
        }
      }

      if (studentId && slotId && slotId !== 'slot-default') {
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', studentId)
          .eq('timetable_id', slotId)
          .eq('date', today)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase
            .from('attendance')
            .update({
              check_out_time: now,
              status: 'present'
            })
            .eq('id', existing.id);
          if (updErr) {
            console.error('Update attendance error:', updErr);
            showPopup(`Attendance update error: ${updErr.message}`, 'error');
          } else {
            showPopup(`Updated check-out for ${studentNameDisplay}`, 'info');
          }
        } else {
          const { error: insErr } = await supabase
            .from('attendance')
            .insert({
              student_id: studentId,
              timetable_id: slotId,
              date: today,
              check_in_time: now,
              status: 'present'
            });
          if (insErr) {
            console.error('Insert attendance error:', insErr);
            showPopup(`Attendance save error: ${insErr.message}`, 'error');
          } else {
            showPopup(`✓ Attendance marked PRESENT for ${studentNameDisplay}`, 'success');
          }
        }
      } else {
        showPopup(`✓ Verified: ${studentNameDisplay}`, 'success');
      }
    } catch (err: any) {
      console.error('Error saving attendance:', err);
    }
  };

  // 4. Perform Face Recognition Scan on Video Frame
  const handlePerformScan = async () => {
    if (scanLockRef.current) return;
    if (!videoRef.current || videoRef.current.videoWidth === 0) return;

    scanLockRef.current = true;

    try {
      const detections = await faceapi.detectAllFaces(videoRef.current as any)
        .withFaceLandmarks()
        .withFaceDescriptors();

      setDetectedFacesCount(detections.length);

      // Draw bounding box overlay on canvas
      if (canvasRef.current && videoRef.current) {
        const displaySize = { 
          width: videoRef.current.clientWidth || 640, 
          height: videoRef.current.clientHeight || 480 
        };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const resized = faceapi.resizeResults(detections, displaySize);
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resized);
        }
      }

      if (detections.length > 0) {
        for (const detection of detections) {
          let matchedStudentKey: string | null = null;
          
          if (faceMatcher) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            if (bestMatch.label !== 'unknown') {
              matchedStudentKey = bestMatch.label;
            }
          }

          // If matched with registered template
          if (matchedStudentKey) {
            const studentKey = matchedStudentKey;

            let displayName = studentKey.toUpperCase();
            if (studentKey === 'student1') displayName = 'Harshini S (ES24CJ12)';
            else if (studentKey === 'student2') displayName = 'Pooja Sri A (ES24CJ15)';
            else if (studentKey === 'student3') displayName = 'Dharani S (ES24CJ08)';
            else if (studentKey === 'student4') displayName = 'Lalitha Shree (ES24CJ17)';
            else if (studentKey === 'student5') displayName = 'Test Student (STU001)';

            if (presentStudentsRef.current.has(displayName)) {
              showPopup(`${displayName} is already marked present!`, 'info');
            } else {
              presentStudentsRef.current.add(displayName);
              setAttendanceLog(Array.from(presentStudentsRef.current));
              logEvent(displayName, 'Check-in', 'Verified');
              await markAttendanceInDatabase(studentKey);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
    } finally {
      scanLockRef.current = false;
    }
  };

  // Continuous loop when auto-scan is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoScanning && isWebcamActive && isModelLoaded) {
      interval = setInterval(() => {
        handlePerformScan();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isAutoScanning, isWebcamActive, isModelLoaded]);

  if (isLoading || !isModelLoaded) {
    return (
      <div className="p-16 text-center text-slate-500 max-w-md mx-auto">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h3 className="font-bold text-slate-800 text-sm mb-1">Loading Face Recognition Module</h3>
        <p className="text-xs text-slate-400">{loadingStatus}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 relative animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Live Facial Attendance</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${isAutoScanning ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              {isAutoScanning ? 'Continuous Scanning Active' : 'Scanner Standby'}
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated AI facial recognition. When a student stands in front of the camera, their face is verified and attendance is marked automatically.
          </p>
        </div>
      </div>

      {popupMsg && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl font-bold text-white flex items-center gap-2 animate-bounce ${
          popupMsg.type === 'error' ? 'bg-red-600' : popupMsg.type === 'success' ? 'bg-emerald-600' : 'bg-amber-500'
        }`}>
          {popupMsg.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          {popupMsg.text}
        </div>
      )}

      {/* Period Selection Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="w-full lg:w-1/2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Select Period Slot *</label>
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          >
            {timetable.map((slot) => (
              <option key={slot.id} value={slot.id}>
                Period {slot.period_number} • {slot.day} • {slot.subjects?.name || slot.subjects?.code || 'Class'}
              </option>
            ))}
          </select>
        </div>

        {activeSlot && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/70 w-full lg:w-auto">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Subject</span>
              <span className="font-mono font-bold text-slate-800">{activeSlot.subjects?.code || '23CI501'}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Faculty</span>
              <span className="font-medium text-slate-800">{activeSlot.staff?.name || 'Faculty Member'}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Time</span>
              <span className="font-mono text-slate-800">{activeSlot.start_time?.slice(0, 5)} - {activeSlot.end_time?.slice(0, 5)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Feed & Scanner controls (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Camera size={18} className="text-blue-600" />
                <span>Live AI Camera Feed</span>
              </h3>
              <div className="flex items-center gap-2">
                {!isWebcamActive ? (
                  <button 
                    onClick={startWebcam} 
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Play size={13} />
                    <span>Turn On Camera</span>
                  </button>
                ) : (
                  <button 
                    onClick={stopWebcam} 
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-1.5"
                  >
                    <Square size={13} />
                    <span>Turn Off Camera</span>
                  </button>
                )}
              </div>
            </div>

            {/* Video Container with Overlaid Canvas */}
            <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border-2 border-slate-800 shadow-inner">
              <video 
                ref={videoRef} 
                width="640"
                height="480"
                className={`w-full h-full object-cover transform scale-x-[-1] ${!isWebcamActive ? 'hidden' : ''}`} 
                autoPlay 
                muted 
                playsInline 
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 pointer-events-none transform scale-x-[-1] ${!isWebcamActive ? 'hidden' : ''}`}
              />

              {isWebcamActive && isAutoScanning && (
                <div className="absolute inset-0 bg-blue-500/5 z-10 pointer-events-none">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-0 animate-[ping_2s_ease-in-out_infinite]"></div>
                </div>
              )}

              {!isWebcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800">
                    <Camera size={28} className="text-slate-400 opacity-60" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Camera is Offline</p>
                  <p className="text-xs text-slate-500">Click &quot;Turn On Camera&quot; above to initialize scanner</p>
                </div>
              )}

              {/* Status Badge Over Camera */}
              {isWebcamActive && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white">
                  <div className={`w-2 h-2 rounded-full ${detectedFacesCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-blue-400'}`} />
                  <span>{detectedFacesCount > 0 ? `${detectedFacesCount} Face(s) Detected` : 'Scanning for Faces...'}</span>
                </div>
              )}
            </div>

            {/* Quick Instant Mark helper when a face is detected */}
            {isWebcamActive && detectedFacesCount > 0 && availableStudents.length > 0 && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-900">
                    Face in Frame! Quick check-in for enrolled student:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableStudents.slice(0, 6).map((stu) => (
                    <button
                      key={stu.id}
                      type="button"
                      onClick={() => {
                        presentStudentsRef.current.add(stu.name);
                        setAttendanceLog(Array.from(presentStudentsRef.current));
                        logEvent(stu.name, 'Check-in', 'Verified');
                        markAttendanceInDatabase(stu.register_number, stu);
                      }}
                      className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all"
                    >
                      ✓ Mark {stu.name ? stu.name.split(' ')[0] : stu.register_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Sparkles size={14} className={isAutoScanning ? "text-emerald-500 animate-pulse" : "text-slate-400"} />
              <span>{isAutoScanning ? "Continuous AI Facial Recognition Active" : "Scanner Paused"}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePerformScan}
                disabled={!isWebcamActive}
                className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                <span>Scan Now</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAutoScanning(!isAutoScanning)}
                disabled={!isWebcamActive}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-40 transition-all flex items-center gap-2 ${
                  isAutoScanning 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                <UserCheck size={14} />
                <span>{isAutoScanning ? "Stop Continuous Scan" : "Start Continuous Scan"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Attendance List & Event Log (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Verified Present Students Counter */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 mb-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Marked Present Today</span>
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {attendanceLog.length} Verified
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {attendanceLog.length === 0 ? (
                <span className="text-slate-400 text-xs py-2">
                  No check-ins yet. Faces recognized via the webcam will appear here and sync to Supabase.
                </span>
              ) : (
                attendanceLog.map((name, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 size={12} />
                    <span>{name.toUpperCase()}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 max-h-[380px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" />
                <span>Live Event Stream</span>
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Real-time</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
              {events.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <Info size={20} className="mx-auto mb-1.5 text-slate-300" />
                  <p>Turn on the camera and start scan to track student verifications.</p>
                </div>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className={`p-3 border rounded-xl flex items-center justify-between text-xs ${
                    ev.status === 'Error' ? 'bg-red-50/80 border-red-200' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                        ev.status === 'Error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {ev.status === 'Error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{ev.student_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ev.time}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      ev.status === 'Error' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {ev.type}
                    </span>
                  </div>
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
