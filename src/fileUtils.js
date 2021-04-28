/**
 * @User: liuliqianxiao
 * @Date: 2017/12/4
 * @Time: 下午5:43
 * @Desc: 操作文件工具函数
 **/
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

/**
 * 同步创建目录
 * @param dirpath 要创建的目录,支持多层级创建
 * @param mode
 */
function mkdirSync(dirpath, mode) {
    try {
        if (!fs.existsSync(dirpath)) {

            var createPaths = [];
            while (dirpath) {
                createPaths.push(dirpath);
                dirpath = path.dirname(dirpath);
                if (fs.existsSync(dirpath)) {
                    break;
                }
            }
            createPaths.reverse();
            createPaths.forEach(function (dirname) {
                if (!fs.mkdirSync(dirname, mode)) {
                    return false;
                }
            });
        }
        return true;
    } catch (e) {
        console.error("create director fail! path=" + dirpath + " errorMsg:" + e);
        return false;
    }
}

/**
 * 拷贝一个目录下所有文件到另一个目录
 * @param srcDirPath
 * @param destDirPath
 */
function copydirSync(srcDirPath, destDirPath) {
    try {
        var files = [];
        if (fs.existsSync(srcDirPath)) {
            files = fs.readdirSync(srcDirPath);
            files.forEach(function (file) {
                var curFilePath = path.join(srcDirPath, file);
                var destFilePath = path.join(destDirPath, file);
                if (fs.statSync(curFilePath).isDirectory()) {
                    copydirSync(curFilePath, destFilePath);
                } else {
                    if (fs.existsSync(destFilePath)) {
                        fs.unlinkSync(destFilePath);
                        copyFileSync(curFilePath, destFilePath);
                    } else {
                        var parentPath = path.dirname(destFilePath);
                        if (mkdirSync(parentPath)) {
                            copyFileSync(curFilePath, destFilePath);
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("create director fail! path=" + dirpath + " errorMsg:" + e);
    }
}

/**
 * 异步拷贝文件
 * @param srcFilePath 拷贝的源文件
 * @param destFilePath 目标路径
 */
function copyFileAsync(srcFilePath, destFilePath) {
    //创建读取流
    var readable = fs.createReadStream(srcFilePath);
    //创建写入流
    var writable = fs.createWriteStream(destFilePath);
    // 通过管道来传输流
    readable.pip(writable);
}

/**
 * 同步拷贝文件
 * @param srcFilePath 拷贝的源文件
 * @param destFilePath 目标路径
 */
function copyFileSync(srcFilePath, destFilePath) {
    var bytes = fs.readFileSync(srcFilePath);
    fs.writeFileSync(destFilePath, bytes);
}

/**
 * 同步删除指定目录下的所前目录和文件,包括当前目录
 * @param dirPath
 * @param includeSelf 是否删除根目录
 * @returns {boolean}
 */
function rmdirSync(dirPath, includeSelf) {
    try {
        var files = [];
        if (fs.existsSync(dirPath)) {
            files = fs.readdirSync(dirPath);
            files.forEach(function (file, index) {
                var curPath = dirPath + "/" + file;
                if (fs.statSync(curPath).isDirectory()) {
                    if (!rmdirSync(curPath, true))
                        return false;
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            if (includeSelf) {
                fs.rmdirSync(dirPath);
            }
        }
    } catch (e) {
        console.error("remove director fail! path=" + dirPath + " errorMsg:" + e);
        return false;
    }
    return true;
}

/**
 * 将目录下的序列帧规整到从0开始
 * @param dirPath
 */
function renameMovieFramesFromZero(dirPath) {
    var subFileList = fs.readdirSync(dirPath);

    if (subFileList.length === 0)
        return;

    var minFrameIndex = NaN;
    var currentFrameIndex;
    var fileList = [];
    subFileList.forEach((subFile) => {

        var shortName = subFile.replace(path.extname(subFile), "");
        if (shortName.length != 4) {
            console.log(dirPath)
            throw new Error(`序列帧必须是6位数！！！`);
        } else {
            currentFrameIndex = parseInt(shortName.substr(2));
            if (isNaN(minFrameIndex) || currentFrameIndex < minFrameIndex) {
                minFrameIndex = currentFrameIndex;
            }
            fileList[currentFrameIndex] = subFile;
        }
    });

    //不需要重命名
    if (minFrameIndex == 0) {
        return;
    }

    var oldFullPath;
    var newFullPath;
    var newFrameIndex;
    fileList.forEach((subFile) => {
        oldFullPath = path.join(dirPath, subFile);
        newFrameIndex = (parseInt(subFile.substr(2, 2)) - minFrameIndex) + "";
        if (newFrameIndex.length == 1) {
            newFrameIndex = "0" + newFrameIndex;
        }
        newFullPath = path.join(dirPath, subFile.substr(0, 2) + newFrameIndex + path.extname(subFile));
        fs.renameSync(oldFullPath, newFullPath);
    });

}

/**
 * 生成某个目录的md5 ---- 子目录名字，文件名要一模一样（根目录名字不需要一样）
 */
function generateDirMd5(rootDir) {
    var obj = {};

    function getAllFileInfo(filePath) {
        if (fs.statSync(filePath).isDirectory()) {
            var subFileList = fs.readdirSync(filePath);
            subFileList.forEach((file) => {
                getAllFileInfo(path.join(filePath, file));
            })
        } else {
            var relativePath = filePath.replace(rootDir + path.sep, "").replace(/\\/g, "/");
            obj[relativePath] = generateFileMd5(filePath);
        }
    }

    getAllFileInfo(rootDir);
    var jsonStr = JSON.stringify(obj);
    return generateStrMd5(jsonStr);
}

/**
 * 生成某个文件的md5
 * @param filePath
 * @return {*}
 */
function generateFileMd5(filePath) {
    var md5 = crypto.createHash("md5");
    var bytes = fs.readFileSync(filePath);
    return md5.update(bytes).digest("hex");
}

/**
 * 生成字符串的md5
 * @param str
 * @return {*}
 */
function generateStrMd5(str) {
    var md5 = crypto.createHash("md5");
    var bytes = Buffer.from(str);
    return md5.update(bytes).digest("hex");
}

/**
 * 生成某个二进制的md5
 * @param bytes
 * @returns {PromiseLike<ArrayBuffer>}
 */
function generateByteMd5(bytes) {
    var md5 = crypto.createHash("md5");
    return md5.update(bytes).digest("hex");
}

module.exports.mkdirSync = mkdirSync;
module.exports.copydirSync = copydirSync;
module.exports.rmdirSync = rmdirSync;
module.exports.copyFileAsync = copyFileAsync;
module.exports.copyFileSync = copyFileSync;
module.exports.generateDirMd5 = generateDirMd5;
module.exports.generateFileMd5 = generateFileMd5;
module.exports.generateStrMd5 = generateStrMd5;
module.exports.generateByteMd5 = generateByteMd5;
module.exports.renameMovieFramesFromZero = renameMovieFramesFromZero;