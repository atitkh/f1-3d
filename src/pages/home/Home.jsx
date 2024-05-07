import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLocationData } from '../../utils/api';
import './home.css';
import MainScene from '../3d/3d';
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";

function Home() {
    const [drivers, setDrivers] = useState([]);
    const sessionKey = '9507';
    const driverData = useRef({});
    const [selectedDriverData, setSelectedDriverData] = useState({ driver_number: 0, broadcast_name: '', team_name: '' });
    const [currentTimeData, setCurrentTimeData] = useState({});
    let currentDriverID = useRef(0);

    const [startTime, setStartTime] = useState('2024-05-05T21:00:00');
    const [endTime, setEndTime] = useState('2024-05-05T22:00:00');

    // Global variable to track time since last animation frame
    let lastAnimationFrameTime = 0;
    const animationDelay = 50; // Delay in milliseconds

    const [loading, setLoading] = useState(false);
    const [loadingPercent, setLoadingPercent] = useState(0);
    const scene = useRef(null);

    function setScene(newScene) {
        scene.current = newScene;
    }

    useEffect(() => {
        async function fetchData() {
            try {
                let drivers = await getAllDrivers();
                await fetchDriverData(drivers[0]);
                await fetchDriverData(drivers[1]);
                await fetchDriverData(drivers[2]);
                await loadCars();
                // Start the animation loop
                animate(0);
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

    async function fetchDriverData(driver) {
        let tempDriverData = {};
        await fetchLocationData(sessionKey, tempDriverData, driver, startTime, endTime);
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
                model.scaling = new BABYLON.Vector3(3, 3, 3);
                driverData.current[driverId].model = model;

                // change the color of the car
                const material = new BABYLON.StandardMaterial("material", scene.current);
                material.diffuseColor = new BABYLON.Color3.FromHexString(`#${drivers[index].team_colour}`);
                model.material = material;
            };
            // driver.onError = (task, message, exception) => {
            //     console.error(message, exception);
            // };
        });
        loader.load();
    }

    function animate(currentTime) {
        requestAnimationFrame(animate);

        // Calculate elapsed time since last frame
        const deltaTime = currentTime - lastAnimationFrameTime;
        // Only proceed with animation if the delay has passed
        if (deltaTime > animationDelay) {
            Object.values(driverData.current).forEach(driver => {
                if (driver.timingData.length && driver.model) {
                    const newPosition = driver.timingData.shift();
                    const oldPosition = driver.model.position;

                    // Calculate the angle in radians between the old and new position
                    const angle = Math.atan2(newPosition.y - oldPosition.y, newPosition.x - oldPosition.x);

                    // Set the global rotation using quaternions
                    // const euler = new BABYLON.Vector3(Math.PI / 2, 0, angle + Math.PI / 2);
                    // const quaternion = BABYLON.Quaternion.FromEulerAngles(euler);
                    // driver.model.rotationQuaternion = quaternion;

                    // Move the model to the new position
                    driver.model.position = new BABYLON.Vector3(newPosition.x, 0, newPosition.y);

                    setCurrentTimeData(prev => {
                        return {
                            ...prev,
                            [driver.driver.driver_number]: newPosition.carData
                        }
                    });
                }
            });

            // Update the last animation frame time
            lastAnimationFrameTime = currentTime;
        }
    }

    function displayDriverDetails(driver, cardata) {
        const detailsContainer = document.getElementById('driverDetails');
        const teamColor = `#${driver.team_colour}`;

        detailsContainer.style.background = teamColor; // Set the dynamic team color as the background
        detailsContainer.innerHTML = `
          <div class="driver-card" style="color: white;">
            <div class="driver-info">
                <span class="driver-name">${driver.broadcast_name}</span>
                <span class="driver-team">${driver.team_name}</span>
            </div>
            <div class="telemetry-data">
                <div class="gear" style="background-color: ${teamColor};">${cardata.n_gear}</div>
                <div class="speed">${cardata.speed} KPH</div>
                <div class="rpm">${cardata.rpm} RPM</div>
                <div class="throttle-bar">
                    <div class="throttle-amount" style="width: ${cardata.throttle}%; background-color: ${teamColor};">Throttle</div>
                </div>
                <div class="brake-bar">
                    <div class="brake-amount" style="width: ${cardata.brake}%; background-color: red;">Break</div>
                </div>
                <div class="drs-status">${cardata.drs}</div>
            </div>
          </div>
        `;
        detailsContainer.style.display = 'block'; // Display the card
    }

    return (
        <div className="home">
            <div className='fps'></div>
            <div className="controls">
                <label htmlFor="startTime">Start Time:</label>
                <input type="datetime-local" id="startTime" value={startTime} onChange={
                    (e) => setStartTime(e.target.value)
                } />
                <label htmlFor="endTime">End Time:</label>
                <input type="datetime-local" id="endTime" value={endTime} onChange={
                    (e) => setEndTime(e.target.value)
                } />
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
            <MainScene setScene={setScene} setLoading={setLoading} setLoadingPercent={setLoadingPercent} displayDriverDetails={displayDriverDetails} />
        </div>
    );
}

export default Home;