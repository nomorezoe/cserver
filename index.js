const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();
const port = 3000;
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
//const { join } = require('path');
const cors = require('cors');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
var timeout = require('connect-timeout')
const { readFileSync } = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


app.use(
    fileUpload({
        limits: {
            fileSize: 10000000,
        },
        abortOnLimit: true,
    })
);

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(cors({
    origin: '*'
}));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Admin app listening on port ${port}`);
});

app.get('/server', (req, res) => {
    res.json({
        "ip": "ws://54.209.44.173:8188"
    });
})

app.post('/upscale', (req, res) => {
    var imageFileName = req.body.file;
    var session = req.body.session;

    //var splits = imageFileName.split("/");
    //imageFileName = splits[splits.length-1];

    const data = readFileSync('./pipeline/workflow_upscale_api.json');
    let json = JSON.parse(data);
    json["client_id"] = session;
    json["prompt"]["2"]["inputs"]["image"] = "../output/" + imageFileName;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "http://127.0.0.1:8188/prompt");
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(json));

    xhr.responseType = "json";
    xhr.onload = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            const data = xhr.responseText;
            console.log(xhr);
            res.json({
                success: true,
                msg: "success",
                data: data
            })
        } else {
            res.json({
                success: false,
                msg: "error" + xhr.status,
            });
        }
    };
})

app.post('/render', (req, res) => {
    // Get the file that was set to our field named "image"
    //console.log(req);

    var cfg = req.body.cfg;
    var model = req.body.model;
    var clipskip = req.body.clipskip;
    var lora = req.body.lora;
    var prompt = req.body.prompt;

    var vae = (req.body.vae == 1) ? 1 : 0;
    var sampleSteps = req.body.sampleSteps;
    var scheduler = req.body.scheduler;
    var inpaintStrength = req.body.inpaintStrength;

    var depthStrength = req.body.depthStrength
    var poseStrength = req.body.poseStrength

    var controlnetModlel = req.body.controlnetModlel
    var session = req.body.session;

    //add style
    var usestyle = 0;
    var style = "non_style";
    if (req.body.usestyle != undefined) {
        usestyle = (req.body.usestyle == 1) ? 1 : 0;
    }
    if (req.body.style != undefined) {
        style = req.body.style;
    }
    //




    //console.log("session====" + session);

    var rawImg = req.files.imageByteArray.data;

    var dirpath = __dirname + '/../fileserver/input/';
    var imgname = uuidv4();
    var imageFileName = imgname + '.png';
    var imageLocation = dirpath + imageFileName;

    var buffer = Buffer.from(rawImg, "base64");
    fs.writeFile(imageLocation, buffer, { flag: "w" }, function (err) {
        if (err == null) {
            generate(session, imageFileName, prompt, responseCallBack);
        }
        else {
            console.log("err" + err);
            responseCallBack({
                success: false,
                msg: "image save failed",
            });
        }
    })


    responseCallBack = function (value) {
        res.json(value);
    }

});

function generate(session, imageFileName, prompt, responseCallBack) {
    const data = readFileSync('./pipeline/workflow_generate_api.json');

    let json = JSON.parse(data);
    json["client_id"] = session;
    json["prompt"]["2"]["inputs"]["image"] = imageFileName;
    json["prompt"]["13"]["inputs"]["text"] = prompt;

    console.log("imageFileName" + imageFileName);
    console.log("jsonstring" + JSON.stringify(json));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "http://127.0.0.1:8188/prompt");
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(json));

    xhr.responseType = "json";
    xhr.onload = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            const data = xhr.responseText;

            responseCallBack({
                success: true,
                msg: "success",
                data: data
            })
        } else {
            responseCallBack({
                success: false,
                msg: "error" + xhr.status,
            });
            console.log(`Error: ${xhr.status}`);
        }
    };

}

