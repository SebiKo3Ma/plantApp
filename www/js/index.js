/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');
}

AWS.config.region = 'eu-central-1'; // Region

// Configure the credentials provider to use Amazon Cognito
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'eu-central-1:681ea9ab-c4a4-486d-82b9-feba4a5da5ad'
});

const s3 = new AWS.S3();
const bucketName = 'raspi-galeata';

async function listRecentObjects(bucketName, maxKeys = 10) {
    const params = {
        Bucket: bucketName,
        MaxKeys: 1000
    };
    
    const data = await s3.listObjectsV2(params).promise();
    // Sort objects by LastModified date in descending order and take the most recent 10
    const recentObjects = data.Contents.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified)).slice(0, maxKeys);
    return recentObjects;
}

async function getObjectData(bucketName, key) {
    const params = {
        Bucket: bucketName,
        Key: key
    };
    
    const data = await s3.getObject(params).promise();
    return data.Body.toString('utf-8');
}

let timestamps = [];
let plant1Moisture = [];
let plant2Moisture = [];

function populateTable(records) {
    const tableBody = document.getElementById('recordsTable').querySelector('tbody');
    records.forEach(record => {
        const row = document.createElement('tr');
        record.forEach(field => {
            const cell = document.createElement('td');
            cell.textContent = field;
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
}

async function fetchAndDisplayRecords() {
    try {
        const recentObjects = await listRecentObjects(bucketName);

        const records = [];
        for (const obj of recentObjects) {
            const csvData = await getObjectData(bucketName, obj.Key);
            const parsedData = Papa.parse(csvData).data; // Parse CSV data
            records.push(...parsedData);

            parsedData.forEach(row => {
                timestamps.push(row[0]);
                plant1Moisture.push(parseFloat(row[1]));
                plant2Moisture.push(parseFloat(row[3]));
            });
        }

        populateTable(records);
        createCharts();
    } catch (error) {
        console.error('Error fetching or displaying records:', error);
    }
}

function createCharts() {
    const ctx1 = document.getElementById('plant1MoistureChart').getContext('2d');
    const ctx2 = document.getElementById('plant2MoistureChart').getContext('2d');

    const linePlugin = {
        id: 'linePlugin',
        afterDatasetsDraw: function(chart) {
            if (chart.tooltip._active && chart.tooltip._active.length) {
                const ctx = chart.ctx;
                const activePoint = chart.tooltip._active[0];
                const datasetIndex = activePoint.datasetIndex;
                const index = activePoint.index;
                const yValue = chart.data.datasets[datasetIndex].data[index];

                ctx.save();
                ctx.font = 'bold 6px Arial';
                ctx.fillStyle = yValue > 20000 ? 'red' : 'blue';
                ctx.textAlign = 'center';
                ctx.fillText(yValue > 20000 ? 'Dry' : 'Wet', activePoint.element.x, activePoint.element.y - 10);
                ctx.restore();
            }
        }
    };

    Chart.register(linePlugin);

    const commonOptions = {
        type: 'line',
        options: {
            plugins: {
                linePlugin: true,
            },
            scales: {
                x: {
                    type: 'linear', // Change x-axis to linear
                    ticks: {
                        callback: function(value, index, values) {
                            return index + 1; // Show index + 1 as the label
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 30000
                }
            },
            plugins: {
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 20000,
                            yMax: 20000,
                            borderColor: 'red',
                            borderWidth: 2
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const index = tooltipItems[0].dataIndex;
                            return timestamps[timestamps.length - 1 - index]; // Show the reversed timestamp
                        }
                    }
                }
            }
        }
    };

    // Reverse the data arrays
    const reversedTimestamps = [...timestamps].reverse();
    const reversedPlant1Moisture = [...plant1Moisture].reverse();
    const reversedPlant2Moisture = [...plant2Moisture].reverse();

    const plant1MoistureChart = new Chart(ctx1, {
        ...commonOptions,
        data: {
            labels: reversedPlant1Moisture.map((_, i) => i + 1), // Use indices as labels
            datasets: [{
                label: 'Plant 1 Moisture',
                data: reversedPlant1Moisture,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                fill: false
            }]
        }
    });

    const plant2MoistureChart = new Chart(ctx2, {
        ...commonOptions,
        data: {
            labels: reversedPlant2Moisture.map((_, i) => i + 1), // Use indices as labels
            datasets: [{
                label: 'Plant 2 Moisture',
                data: reversedPlant2Moisture,
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                fill: false
            }]
        }
    });
}

fetchAndDisplayRecords();
