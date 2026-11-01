import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';

const Attendance: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [attendanceLog, setAttendanceLog] = useState<string[]>([]);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [targetTime, setTargetTime] = useState<string>("");
  const hasScannedRef = useRef<boolean>(false);
  
  // NEW STATES: For scanning animation and error handling
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const students = ['student1', 'student2', 'student3', 'student4'];
  const NUM_SAMPLES_PER_STUDENT = 10; 

  useEffect(() => {
    const loadModelsAndData = async () => {
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
              console.error(`Error loading /students/${student}/${i}.jpeg`, err);
            }
          }
          return descriptions.length > 0 
            ? new faceapi.LabeledFaceDescriptors(student, descriptions) 
            : null;
        })
      );

      const validDescriptors = labeledDescriptors.filter((desc): desc is faceapi.LabeledFaceDescriptors => desc !== null);
      setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.45)); 
      setIsModelLoaded(true);
    };

    loadModelsAndData();
  }, []);

  const handleScan = async () => {
    if (!webcamRef.current || !faceMatcher || !webcamRef.current.video) return;
    
    // 1. Start scanning animation & clear old errors
    setIsScanning(true);
    setScanError(null);

    try {
      const video = webcamRef.current.video;
      const detections = await faceapi.detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length > 0) {
        let foundUnknown = false;

        detections.forEach((detection) => {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          
          // 2. Check if the face is recognized or unknown
          if (bestMatch.label !== 'unknown') {
            markPresent(bestMatch.label);
          } else {
            foundUnknown = true;
          }
        });

        // 3. Trigger error if an unknown person is in the frame
        if (foundUnknown) {
          setScanError("Alert: Unrecognized person detected in frame!");
          // Auto-clear error after 4 seconds
          setTimeout(() => setScanError(null), 4000); 
        }

      } else {
        setScanError("No face detected. Please face the camera.");
        setTimeout(() => setScanError(null), 3000);
      }
    } catch (error) {
      console.error("Error during scan:", error);
    } finally {
      // 4. Stop scanning animation
      setIsScanning(false);
    }
  };

  const markPresent = async (studentName: string) => {
    let displayName = studentName.toUpperCase();
    let regNo = '';
    if (studentName === 'student1') { displayName = 'Harshini S (ES24CJ12)'; regNo = 'ES24CJ12'; }
    else if (studentName === 'student2') { displayName = 'Pooja Sri A (ES24CJ15)'; regNo = 'ES24CJ15'; }
    else if (studentName === 'student3') { displayName = 'Dharani S (ES24CJ08)'; regNo = 'ES24CJ08'; }
    else if (studentName === 'student4') { displayName = 'Lalitha Shree (ES24CJ17)'; regNo = 'ES24CJ17'; }
    else if (studentName === 'student5') { displayName = 'Test Student (STU001)'; regNo = 'STU001'; }

    setAttendanceLog((prev) => {
      if (!prev.includes(displayName)) return [...prev, displayName];
      return prev;
    });

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      const { data: stu } = await supabase
        .from('students')
        .select('id')
        .eq('register_number', regNo)
        .maybeSingle();

      const { data: slot } = await supabase
        .from('timetable')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (stu?.id && slot?.id) {
        await supabase
          .from('attendance')
          .upsert({
            student_id: stu.id,
            timetable_id: slot.id,
            date: today,
            check_in_time: now,
            status: 'present'
          }, { onConflict: 'student_id,timetable_id,date' });
      }
    } catch (err) {
      console.warn('Error saving attendance in Supabase:', err);
    }
  };

  useEffect(() => {
    if (isModelLoaded && faceMatcher && targetTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const currentHHMM = now.toTimeString().slice(0, 5); 

        if (currentHHMM === targetTime && !hasScannedRef.current) {
          handleScan();
          hasScannedRef.current = true;
        } else if (currentHHMM !== targetTime) {
          hasScannedRef.current = false;
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isModelLoaded, faceMatcher, targetTime]);

  return (
    <div className="p-6 text-center font-sans max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Frontend Attendance System</h2>
      
      {!isModelLoaded ? (
        <div className="flex flex-col items-center justify-center mt-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading AI Models & Compiling Student Folders...</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex justify-center gap-4 items-center">
            <div>
              <label className="font-bold mr-2">Auto-Scan Time:</label>
              <input 
                type="time" 
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <button 
              onClick={handleScan}
              disabled={isScanning}
              className="px-5 py-2 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Scanning...
                </>
              ) : (
                "Scan Now"
              )}
            </button>
          </div>

          {/* NEW: Error Alert Box */}
          {scanError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg font-bold animate-pulse">
              ⚠️ {scanError}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-center gap-6">
            <div className="relative overflow-hidden rounded-lg border-4 border-gray-200 shadow-lg bg-black flex-shrink-0">
              <Webcam 
                ref={webcamRef} 
                muted={true} 
                className="w-[500px] h-[375px] object-cover"
              />
              
              {/* NEW: Visual Scanning Overlay on top of webcam */}
              {isScanning && (
                <div className="absolute inset-0 bg-blue-500/20 z-10 flex flex-col items-center justify-center">
                   <div className="w-full h-1 bg-blue-400 absolute top-1/2 animate-[ping_1.5s_ease-in-out_infinite]"></div>
                   <span className="text-white font-bold text-xl drop-shadow-md bg-black/50 px-4 py-1 rounded-full mt-12">
                     Analyzing Faces...
                   </span>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg min-w-[250px] text-left shadow-md border border-gray-200 h-[375px] overflow-y-auto">
              <h3 className="mt-0 text-xl font-bold border-b pb-2 text-gray-800">Present Today</h3>
              <ul className="list-none p-0 mt-4 space-y-3">
                {attendanceLog.length === 0 && <li className="text-gray-500 italic">No one detected yet.</li>}
                {attendanceLog.map((student, idx) => (
                  <li key={idx} className="text-green-700 font-bold text-lg flex items-center gap-2 bg-green-50 p-2 rounded border border-green-200">
                    ✅ {student.toUpperCase()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Attendance;