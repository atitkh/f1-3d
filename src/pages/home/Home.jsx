import React, { useEffect, useRef, useState } from 'react';
import { fetchLocationData } from '../../utils/api';
import './home.css';
import MainScene from '../3d/3d';
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";

function Home() {
    const sessionKey = '9507';

    const [drivers, setDrivers] = useState([]); // all drivers in the session
    const driverData = useRef({}); // all driver data (timing data, model, driver info)
    const sessionData = useRef({}); // session data (start time, end time, etc.)
    const [selectedDriverData, setSelectedDriverData] = useState({ driver_number: 0, broadcast_name: '', team_name: '' }); // selected driver data
    const [currentTimeData, setCurrentTimeData] = useState({}); // current time data for selected driver (telemetry data)

    let currentDriverID = useRef(0); // current driver ID

    const startTime = useRef('2024-05-05T20:00:00+00:00'); // start time of the session updated later with the actual start time
    const endTime = useRef('2024-05-05T22:00:00+00:00'); // end time of the session updated later with the actual end time

    const [simulationTime, setSimulationTime] = useState(null); // simulation time for the race
    const [raceDataTime, setRaceDataTime] = useState(null); // time of the race data (actual time of event)
    const [isSyncingTime, setIsSyncingTime] = useState(false); // 

    const [loading, setLoading] = useState(false); // loading state of the scene
    const [loadingPercent, setLoadingPercent] = useState(0); // loading percentage of the scene

    const scene = useRef(null); // reference to the babylon scene

    function setScene(newScene) {
        scene.current = newScene;
    }

    useEffect(() => {
        async function fetchData() {
            try {
                let drivers = await getAllDrivers();
                await fetchSessionData(sessionKey);
                for (let driver of drivers) {
                    await fetchDriverData(driver);
                }
                await loadCars();
                animate(); // start animation

            } catch (error) {
                console.error(error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedDriverData.driver_number !== 0) {
            currentDriverID.current = selectedDriverData.driver_number;
        }
    }, [selectedDriverData]);

    async function fetchSessionData(sessionKey) {
        const response = await fetch(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`);
        const data = await response.json();
        sessionData.current = data[0];
        startTime.current = data[0].date_start;
        endTime.current = data[0].date_end;
    }

    async function fetchDriverData(driver) {
        let tempDriverData = {};
        await fetchLocationData(sessionKey, tempDriverData, driver, startTime.current, endTime.current);
        driverData.current[driver.driver_number] = tempDriverData[driver.driver_number];
    }

    async function getAllDrivers() {
        const response = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
        const data = await response.json();
        setDrivers(data);
        setSelectedDriverData(data[0]);
        return data;
    }

    async function loadCars() {
        // load cars
        const loader = new BABYLON.AssetsManager(scene.current);
        BABYLON.SceneLoader.ShowLoadingScreen = false;
        Object.keys(driverData.current).forEach((driverId, index) => {
            const driver = loader.addMeshTask(`driver-${driverId}`, "", "assets/car/", "scene.gltf");
            driver.onSuccess = (task) => {
                const model = task.loadedMeshes[0];
                model.name = `driver-${driverId}`;
                model.scaling = new BABYLON.Vector3(1, 1, 1);
                // model.position = new BABYLON.Vector3(driverData.current[driverId].timingData[0].x, 0, driverData.current[driverId].timingData[0].y);
                model.position = new BABYLON.Vector3(0.1, 0.1, 0.1);
                driverData.current[driverId].model = model;
            };
            // driver.onError = (task, message, exception) => {
            //     console.error(message, exception);
            // };
        });
        loader.load();
    }

    // function animate(currentTime) {
    //     requestAnimationFrame(animate);

    //     // Calculate elapsed time since last frame
    //     const deltaTime = currentTime - lastAnimationFrameTime;
    //     // Only proceed with animation if the delay has passed
    //     if (deltaTime > animationDelay) {
    //         Object.values(driverData.current).forEach(driver => {
    //             if (driver.timingData.length && driver.model) {
    //                 const newPosition = driver.timingData.shift();
    //                 const oldPosition = driver.model.position;

    //                 // Calculate the angle in radians between the old and new position
    //                 const angle = Math.atan2(newPosition.x - oldPosition.x, newPosition.y - oldPosition.z);

    //                 // Set the global rotation using quaternions
    //                 driver.model.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), angle);

    //                 // Move the model to the new position
    //                 driver.model.position = new BABYLON.Vector3(newPosition.x, 0, newPosition.y);

    //                 setCurrentTimeData(prev => ({
    //                     ...prev,
    //                     [driver.driver.driver_number]: newPosition.carData
    //                 }));
    //             }
    //         });

    //         // Update the last animation frame time
    //         lastAnimationFrameTime = currentTime;
    //     }
    // }

    function interpolatePosition(oldPosition, newPosition, t) {
        const interpolatedX = BABYLON.Scalar.Lerp(oldPosition.x, newPosition.x, t);
        const interpolatedY = BABYLON.Scalar.Lerp(oldPosition.y, newPosition.y, t);
        const interpolatedZ = BABYLON.Scalar.Lerp(oldPosition.z, newPosition.z, t);
        return new BABYLON.Vector3(interpolatedX, interpolatedY, interpolatedZ);
    }

    function animate() {
        requestAnimationFrame(animate);

        const currentTime = performance.now();
        const raceSimulationTime = new Date(startTime.current).getTime() + currentTime;
        setSimulationTime(raceSimulationTime);

        Object.values(driverData.current).forEach(driver => {
            if (driver.timingData.length > 1 && driver.model) {
                const currentData = driver.timingData[0];
                const nextData = driver.timingData[1];

                const currentDataTime = currentData.time;
                const nextDataTime = nextData.time;
                setRaceDataTime(currentDataTime);

                const timeSinceCurrentData = raceSimulationTime - currentDataTime;
                const timeDiff = nextDataTime - currentDataTime;
                const t = Math.min(1, Math.max(0, timeSinceCurrentData / timeDiff));

                // console.log(`Time Since Current Data for driver ${driver.driver.driver_number}:`, currentDataTime, timeSinceCurrentData);
                // console.log(`Time Diff for driver ${driver.driver.driver_number}:`, timeDiff);
                // console.log(`Interpolation value (t) for driver ${driver.driver.driver_number}:`, t);

                if (t < 1 && t >= 0) {
                    setIsSyncingTime(false);
                    const interpolatedPosition = interpolatePosition(new BABYLON.Vector3(currentData.x, currentData.y, currentData.z),
                        new BABYLON.Vector3(nextData.x, nextData.y, nextData.z), t);
                    driver.model.position = interpolatedPosition;

                    const angle = Math.atan2(nextData.x - currentData.x, nextData.z - currentData.z);
                    driver.model.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), angle);
                } else if (t >= 1) {
                    if (!isSyncingTime) setIsSyncingTime(true);
                    driver.timingData.shift(); // Shift to next dataset when t >= 1
                }

                setCurrentTimeData(prev => ({
                    ...prev,
                    [driver.driver.driver_number]: currentData.carData
                }));
            }
        });
    }

    function getSpeed(driver) {
        const previousDataPoint = driver.timingData[0]; // Assuming data is sorted by time
        if (previousDataPoint) {
            const speedInKmh = driver.timingData[0].carData.speed;

            // Convert speed from km/h to desired units (e.g., meters per second)
            const speedInMps = speedInKmh * 1000 / 3600; // Conversion factor

            return speedInMps;
        } else {
            // Handle cases where there's no previous data point (initial data point)
            return 0; // Or a default speed if applicable
        }
    }

    return (
        <div className="home">
            <div className='top_info'>
                <div className='fps'></div>
                <span>Race Date: {sessionData.current.date_start ? new Date(sessionData.current.date_start).toLocaleDateString() : '00/00/0000'}</span>
                <span>Simulation Time: {simulationTime ? new Date(simulationTime).toLocaleTimeString() : '00:00:00'}</span>
                <span>Event Time: {raceDataTime ? new Date(raceDataTime).toLocaleTimeString() : '00:00:00'}</span>
            </div>
            <div className='overlay'>
                <div className="controls">
                    <label htmlFor="driverSelect">Driver:</label>
                    <select id="driverSelect" onChange={(e) => setSelectedDriverData(drivers.find(driver => driver.driver_number === parseInt(e.target.value)))}>
                        {drivers.map(driver => (
                            <option key={driver.driver_number} value={driver.driver_number}>{driver.broadcast_name}</option>
                        ))}
                    </select>
                    <button id="getDriverDetailsButton">Get Driver Details</button>
                </div>

                <div id="driverDetails" className="driver-details" style={
                    {
                        display: selectedDriverData?.driver_number === 0 ? 'none' : 'block',
                        backgroundColor: '#' + selectedDriverData?.team_colour,
                    }
                }>
                    <div className="driver-card">
                        <div className="driver-info">
                            {isSyncingTime && <div className="syncing-logo blink">Syncing...</div>}
                            <span className="driver-name">{selectedDriverData?.broadcast_name}</span>
                            <span className="driver-name">{selectedDriverData?.driver_number}</span>
                            <span className="driver-team">{selectedDriverData?.team_name}</span>
                        </div>
                        {selectedDriverData?.driver_number !== 0 &&
                            <div className="telemetry-data">
                                <div className="gear" style={{ backgroundColor: selectedDriverData?.teamColor }}>{currentTimeData[selectedDriverData?.driver_number]?.n_gear}</div>
                                <div className="speed">{currentTimeData[selectedDriverData?.driver_number]?.speed} KPH</div>
                                <div className="rpm">{currentTimeData[selectedDriverData?.driver_number]?.rpm} RPM</div>
                                <div className="throttle-bar">
                                    <div className="throttle-amount" style={{ width: `${currentTimeData[selectedDriverData?.driver_number]?.throttle}%`, backgroundColor: 'blue' }}>Throttle</div>
                                </div>
                                <div className="brake-bar">
                                    <div className="brake-amount" style={{ width: `${currentTimeData[selectedDriverData?.driver_number]?.brake}%`, backgroundColor: 'red' }}>Break</div>
                                </div>
                                <div className="drs-status">{currentTimeData[selectedDriverData?.driver_number]?.drs}</div>
                            </div>
                        }
                    </div>
                </div>
            </div>
            <MainScene setScene={setScene} setLoading={setLoading} setLoadingPercent={setLoadingPercent} />
        </div>
    );
}

export default Home;