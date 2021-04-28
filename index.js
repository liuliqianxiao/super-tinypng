const fs = require('fs');
const path = require('path');
const https = require('https');
const {URL} = require('url');
const fileUtils = require("./src/fileUtils");

//未压缩的原始资源目录
var originalResourceRoot = "";
//压缩资源的输出目录
var destResourceRoot = ""

let argLength = process.argv.length;
if (argLength === 2) {
    // originalResourceRoot = path.resolve("./test");
    originalResourceRoot = path.resolve("E:\\Laya\\jzxj\\client\\laya\\assets");
    destResourceRoot = path.resolve("./output");
} else if (argLength === 3) {
    originalResourceRoot = path.resolve(process.argv[2]);
    destResourceRoot = path.resolve("./output");
    console.warn("未设置资源输出目录，默认为" + destResourceRoot)
} else {
    originalResourceRoot = path.resolve(process.argv[2]);
    destResourceRoot = path.resolve(process.argv[3]);
    console.log(`当前原始资源目录：${originalResourceRoot},压缩输出目录：${destResourceRoot}`)
}

//如果有输出目录，先清空，否则就创建输出目录
fileUtils.rmdirSync(destResourceRoot, false);
fileUtils.mkdirSync(destResourceRoot);

const maxHttpThread = 10;//最多同时有多少个http请求
var currentUseHttp = 0;//当前使用的http个数
var maxTryTimes = 3;
var currentTryTime = 0;
const watchExtension = ['.jpg', '.png'];
const options = {
    method: 'POST',
    hostname: 'tinypng.com',
    path: '/web/shrink',
    headers: {
        rejectUnauthorized: false,
        'Postman-Token': Date.now(),
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
};

var waitToCompressFiles = [];
var failCompressFiles = [];

//扫描目录下所有可以压缩的图片资源
filterImagesFiles(originalResourceRoot);
console.log(`>>>>>>>>>>>>>>>>>>>>>>>>总计有${waitToCompressFiles.length}个文件等待压缩<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`);

startUpload();

// 获取文件列表
function filterImagesFiles(imagePathOrDir) {
    if (fs.statSync(imagePathOrDir).isDirectory()) {
        var fileList = fs.readdirSync(imagePathOrDir);
        for (let i = 0; i < fileList.length; i++) {
            filterImagesFiles(path.join(imagePathOrDir, fileList[i]));
        }
    } else {
        var extension = path.extname(imagePathOrDir);
        if (watchExtension.indexOf(extension) !== -1) {
            waitToCompressFiles.push(imagePathOrDir);
        }
    }
}

function startUpload() {
    if (waitToCompressFiles.length === 0 && currentUseHttp === 0) {
        compressAllComplete();
    }
    while (currentUseHttp < maxHttpThread && waitToCompressFiles.length > 0) {
        uploadNext();
    }
}

function uploadNext() {
    var imagePath = waitToCompressFiles.pop();
    options.headers['X-Forwarded-For'] = getRandomIP();
    currentUseHttp++;
    var req = https.request(options, function (res) {
        res.on('data', buf => {
            try {
                let obj = JSON.parse(buf.toString());
                if (obj.error) {
                    uploadError(imagePath);
                    console.log(`[${imagePath}]：压缩失败！报错：${obj.message}`);
                } else {
                    fileDownload(imagePath, obj);
                }
            } catch (e) {
                uploadError(imagePath);
            }
        });
    });

    req.write(fs.readFileSync(imagePath), 'binary');
    req.on('error', e => {
        uploadError(imagePath);
        console.error(e);
    });
    req.end();
}

//上传失败
function uploadError(imagePath) {
    failCompressFiles.push(imagePath);
    currentUseHttp--;
    startUpload();
}

function fileDownloadError(imagePath) {
    failCompressFiles.push(imagePath);
    currentUseHttp--;
    startUpload();
}

//下载保存成功
function downloadSuccess() {
    currentUseHttp--;
    startUpload();
}

// 生成随机IP， 赋值给 X-Forwarded-For
function getRandomIP() {
    return Array.from(Array(4)).map(() => parseInt(Math.random() * 255)).join('.')
}


// 该方法被循环调用,请求图片数据
function fileDownload(imagePath, obj) {
    let options = new URL(obj.output.url);
    let req = https.request(options, res => {
        let body = '';
        res.setEncoding('binary');
        res.on('data', function (data) {
            body += data;
        });

        res.on('end', function () {
            saveCompressedFile(imagePath, body, obj.input.size, obj.output.size, obj.output.ratio);
            downloadSuccess();
        });
    });
    req.on('error', e => {
        fileDownloadError(imagePath);
        console.error(e);
    });
    req.end();
}

function saveCompressedFile(originalPath, compressContent, inputSize, outputSize, compressRatio) {
    let outputImagePath = path.join(destResourceRoot, originalPath.replace(originalResourceRoot + path.sep, ""));
    fileUtils.mkdirSync(path.dirname(outputImagePath));
    fs.writeFileSync(outputImagePath, compressContent, 'binary');
    console.log(`[====================${originalPath}] \n 压缩成功，原始大小:${inputSize}，压缩大小:${outputSize}，优化比例:${compressRatio}`);
}

function compressAllComplete() {

    if (currentTryTime < maxTryTimes && failCompressFiles.length > 0) {
        currentTryTime++;
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>失败的文件重新发起压缩请求,当前重试次数：${currentTryTime}<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`)
        waitToCompressFiles = Array.from(failCompressFiles);
        failCompressFiles.length = 0;
        startUpload();
    } else {
        console.log(`===========================所有资源压缩完成,失败${failCompressFiles.length}个==================================`);
        failCompressFiles.forEach((imagePath)=>{
            console.log(`XXXXXXXXXXXXXXXXXXXXXXXXX    ${imagePath}    XXXXXXXXXXXXXXXXXXXXXXXXX`);
        });
    }
}
