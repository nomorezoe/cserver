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
const ExifReader = require('exifreader');


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
        //"ip": "ws://127.0.0.1:8188"
    });
})

function getRandomInt(max) {
    return Math.floor(Math.random() * (max-1)) + 1;
  }
  

async function processUpscale(file, imageFileName, session, res){
    fs.readFile(file, (err, data)=>{
        const tags =  ExifReader.load(data);
        var model = "dynavisionXL.safetensors";
    
        if(tags.prompt && tags.prompt.value){
            var jsonString = tags.prompt.value;
            console.log(jsonString);
            var jsonSettings = JSON.parse(jsonString);
            
            var model = jsonSettings["7"]["inputs"]["ckpt_name"];
            var prompt = jsonSettings["19"]["inputs"]["text_positive"];
            var style = jsonSettings["19"]["inputs"]["style"];
    
            
            const data = readFileSync('./pipeline/workflow_upscale_api_denoise.json');
            let json = JSON.parse(data);
            json["client_id"] = session;
            json["prompt"]["2"]["inputs"]["image"] = "../output/" + imageFileName;
            json["prompt"]["6"]["inputs"]["ckpt_name"] = model;
    
            json["prompt"]["12"]["inputs"]["text_positive"] = prompt;
            json["prompt"]["12"]["inputs"]["style"] = style;

            json["prompt"]["7"]["inputs"]["seed"] = getRandomInt(4294967294);
    
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://127.0.0.1:8188/prompt");
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(JSON.stringify(json));
    
        xhr.responseType = "json";
        xhr.onload = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                const data = xhr.responseText;
                //console.log(xhr);
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
        }
    });
    
}
app.post('/upscale', (req, res) => {
    var imageFileName = req.body.file;
    var session = req.body.session;
    var denoiseValue = req.body.denoisevalue;
    console.log("denoiseValue:" + denoiseValue);

    console.log("imageFileName"+imageFileName);

    var filePath = __dirname + '/../fileserver/output/'+imageFileName;
    processUpscale(filePath, imageFileName, session, res);

    

    //var splits = imageFileName.split("/");
    //imageFileName = splits[splits.length-1];

})
app.post('/inpaint', (req, res) => {
    var rawImg = req.files.imageByteArray.data;

    var session = req.body.session;
    var reqFile = req.body.file;
    var reqPrompt = req.body.prompt;

    var dirpath = __dirname + '/../fileserver/input/';
    var imgname = uuidv4();
    var imageFileName = imgname + '.png';
    var imageLocation = dirpath + imageFileName;

    var buffer = Buffer.from(rawImg, "base64");
    fs.writeFile(imageLocation, buffer, { flag: "w" }, function (err) {
        if (err == null) {
            //session, prompt, filename, maskfilename, res
            inpaint(session,reqPrompt,reqFile,  imageFileName, res);
        }
        else {
            res.json({
                success: false,
                msg: "image failed",
            })
        }
    })

});

app.post('/render', (req, res) => {
    // Get the file that was set to our field named "image"
    //console.log(req);
    var model = "dynavisionXL";
    if(req.body.model != undefined){
        model = req.body.model
    }
    var cfg = req.body.cfg;
    var prompt = req.body.prompt;

    var sampleSteps = req.body.sampleSteps;
    var scheduler = req.body.scheduler;
    var sampler = req.body.sampler;

    var depthStrength = req.body.depthStrength
    var poseStrength = req.body.poseStrength

    var session = req.body.session;

    var pretext = req.body.pretext;
    var negtext = req.body.negtext;

    //add style
    style = req.body.style;
    //

    console.log("style====" + style);
    console.log("cfg====" + cfg);
    console.log("sampleSteps====" + sampleSteps);
    console.log("scheduler====" + scheduler);
    console.log("sampler====" + sampler);
    console.log("depthStrength====" + depthStrength);
    console.log("poseStrength====" + poseStrength);
    console.log("model====" + model);

    console.log("pretext====" + pretext);
    console.log("negtext====" + negtext);

    var rawImg = req.files.imageByteArray.data;

    var dirpath = __dirname + '/../fileserver/input/';
    var imgname = uuidv4();
    var imageFileName = imgname + '.png';
    var imageLocation = dirpath + imageFileName;

    var buffer = Buffer.from(rawImg, "base64");
    fs.writeFile(imageLocation, buffer, { flag: "w" }, function (err) {
        if (err == null) {
            generate(session, model, style, cfg, sampleSteps, scheduler, sampler, depthStrength, poseStrength, imageFileName, prompt, responseCallBack);
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

function  isSD15Model(model){
    return model == "realistic_vision_v6" || model == "Deliberate_v5"||model == "dreamshaper";
}

function generate(session, model, style, cfg, sampleSteps, scheduler, sampler, depthStrength, poseStrength, imageFileName, prompt, responseCallBack) {
    const data = readFileSync('./pipeline/workflow_generate_api.json');

    let json = JSON.parse(data);
    json["client_id"] = session;
    json["prompt"]["6"]["inputs"]["seed"] = getRandomInt(4294967294);
    json["prompt"]["7"]["inputs"]["ckpt_name"] = model + ".safetensors";
    json["prompt"]["2"]["inputs"]["image"] = imageFileName;
    json["prompt"]["19"]["inputs"]["text_positive"] = prompt;
    json["prompt"]["19"]["inputs"]["style"] = style;

    json["prompt"]["6"]["inputs"]["steps"] = parseInt(sampleSteps);
    json["prompt"]["6"]["inputs"]["cfg"] = parseInt(cfg);
    json["prompt"]["6"]["inputs"]["sampler_name"] = sampler;
    json["prompt"]["6"]["inputs"]["scheduler"] = scheduler;

    json["prompt"]["5"]["inputs"]["strength"] = parseFloat(depthStrength);
    json["prompt"]["18"]["inputs"]["strength"] = parseFloat(poseStrength);

    if(isSD15Model(model)){
        console.log("is sd1.5");
        json["prompt"]["17"]["inputs"]["control_net_name"]="control_openpose-fp16.safetensors";
        json["prompt"]["4"]["inputs"]["control_net_name"]="control_depth-fp16.safetensors";
    }

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
                data: data,
                steps : 4,
                progress: 1
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

function inpaint(session, prompt, filename, maskfilename, res){
    var filePath = __dirname + '/../fileserver/output/'+filename;
    console.log("filepath" + filePath);
    fs.readFile(filePath, (err, data)=>{
        const tags =  ExifReader.load(data);
        var model = "dynavisionXL.safetensors";
    
        if(tags.prompt && tags.prompt.value){
            var jsonString = tags.prompt.value;
            console.log(jsonString);
            var jsonSettings = JSON.parse(jsonString);
            
            var model = jsonSettings["7"]["inputs"]["ckpt_name"];
            //var prompt = jsonSettings["19"]["inputs"]["text_positive"];
            //var style = jsonSettings["19"]["inputs"]["style"];

            const data = readFileSync('./pipeline/workflow_inpaint_api.json');

            let json = JSON.parse(data);
            json["client_id"] = session;

            json["prompt"]["1"]["inputs"]["image"] = maskfilename;
            json["prompt"]["2"]["inputs"]["image"] = filename;
            json["prompt"]["13"]["inputs"]["text"] = prompt;
            json["prompt"]["11"]["inputs"]["ckpt_name"] = model;

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "http://127.0.0.1:8188/prompt");
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.send(JSON.stringify(json));

            xhr.responseType = "json";
            xhr.onload = () => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    const data = xhr.responseText;

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
                    console.log(`Error: ${xhr.status}`);
                }
            };
        }
    })
    
}

