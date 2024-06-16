document.addEventListener('deviceready', onDeviceReady, false);

async function loadModel() {
    // Load the pre-trained TensorFlow.js model
    const model = await tf.loadLayersModel("https://www.kaggle.com/models/rishitdagli/plant-disease/TfJs/default/1", { fromTFHub: true });
    return model;
}

async function identifyPlant(imageElement, model) {
    // Preprocess the image to match the input requirements of the model
    const tensor = tf.browser.fromPixels(imageElement)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .expandDims()
        .div(tf.scalar(127.5))
        .sub(tf.scalar(1));

    // Make predictions using the model
    const predictions = await model.predict(tensor).data();

    return predictions;
}

function onDeviceReady() {
    const takePictureButton = document.getElementById('takePicture');
    const plantImage = document.getElementById('plantImage');
    const resultText = document.getElementById('result');

    let model;

    takePictureButton.addEventListener('click', () => {
        navigator.camera.getPicture(onSuccess, onFail, {
            quality: 50,
            destinationType: Camera.DestinationType.DATA_URL,
            sourceType: Camera.PictureSourceType.CAMERA,
            encodingType: Camera.EncodingType.JPEG,
            mediaType: Camera.MediaType.PICTURE,
            targetWidth: 224,
            targetHeight: 224,
            correctOrientation: true
        });
    });

    function onSuccess(imageData) {
        plantImage.src = "data:image/jpeg;base64," + imageData;
        plantImage.style.display = 'block';

        if (!model) {
            loadModel().then(loadedModel => {
                model = loadedModel;
                identifyAndDisplayPlant();
            });
        } else {
            identifyAndDisplayPlant();
        }
    }

    function onFail(message) {
        alert('Failed because: ' + message);
    }

    function identifyAndDisplayPlant() {
        identifyPlant(plantImage, model).then(predictions => {
            console.log('Health predictions:', predictions);
            resultText.textContent = `Health predictions: ${predictions.join(', ')}`;
        });
    }
}
