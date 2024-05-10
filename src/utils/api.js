import { location_data, car_data } from './constants.js';

function scaleCoordinates(x, y, scale_factor) {
  return [x / scale_factor, y / scale_factor];
}

// Function to fetch and store location and car data for each driver
export async function fetchLocationData(sessionKey, driverDataStore, driver, startTime, endTime, scaleFactor = 100) {
  let driverId = driver.driver_number;
  const fetchStartTime = performance.now();
  
  const carData = car_data;
  const locationData = location_data;

  // const locationUrl = `https://api.openf1.org/v1/location?session_key=${sessionKey}&driver_number=${driverId}&date>=${startTime}&date<${endTime}`;
  // const Driverurl = `https://api.openf1.org/v1/drivers?driver_number=${driverId}&session_key=${sessionKey}`;
  // const carDataUrl = `https://api.openf1.org/v1/car_data?session_key=${sessionKey}&driver_number=${driverId}&date>=${startTime}&date<${endTime}`;

  // const [locationResponse, carDataResponse] = await Promise.all([
  //   fetch(locationUrl),
  //   fetch(carDataUrl)
  // ]);

  // const locationData = await locationResponse.json(); 
  // const carData = await carDataResponse.json();

  const fetchEndTime = performance.now();
  console.log(`Time taken to fetch data: ${(fetchEndTime - fetchStartTime).toFixed(2)} milliseconds`);

  // Sort location and car data by date
  locationData.sort((a, b) => new Date(a.date) - new Date(b.date));
  carData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Merge location and car data using a sliding window approach
  const mergeStartTime = performance.now();
  let carDataIndex = 0;
  const mergedData = locationData.map(location => {
    const [scaledX, scaledY] = scaleCoordinates(location.x, location.y, scaleFactor);
    const locationDate = new Date(location.date);

    let closestCarData = carData[carDataIndex];
    let minTimeDiff = Math.abs(locationDate - new Date(closestCarData.date));

    for (let i = carDataIndex + 1; i < carData.length; i++) {
      const timeDiff = Math.abs(locationDate - new Date(carData[i].date));
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestCarData = carData[i];
        carDataIndex = i;
      } else {
        break;
      }
    }

    return {
      x: scaledX,
      z: scaledY,
      y: 0,
      date: location.date,
      time: new Date(location.date).getTime(),
      carData: closestCarData,
    };
  });

  const mergeEndTime = performance.now();
  console.log(`Time taken to merge location data: ${(mergeEndTime - mergeStartTime).toFixed(2)} milliseconds`);

  driverDataStore[driverId] = {
    timingData : mergedData,
    driver: driver,
  }
  //console.log(mergedData);
}