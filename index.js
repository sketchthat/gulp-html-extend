/* Created by frank on 14-7-24. */
/* jshint -W040:true */
'use strict';

var fs = require('fs')
var path = require('path')
var through2 = require('through2')
var gUtil = require('gulp-util')
var PluginError = gUtil.PluginError
var es = require('event-stream')

var pkg = require('./package.json')


module.exports = function (options) {

    options = options || {}

    return through2.obj(function (file, enc, cb) {

        if (file.isNull()) {
            this.push(file)
            return cb()
        }

        if (file.isBuffer()) {

            extendFile(file, function () {
                this.push(file)
                return cb()
            }.bind(this))
        }

        if (file.isStream()) {
            return cb(new PluginError(pkg.name, 'Streaming is not supported'))
        }

    })

}

function makeFile(absolutePath, cb) {
    fs.readFile(absolutePath, function (error, data) {
        if (error) { throw error }
        var file = new gUtil.File({
            base: path.dirname(absolutePath),
            path: absolutePath,
            contents: new Buffer(data),
        })
        cb(file)
    })
}

function extendFile(file, afterExtend) {
    var masterRelativePath = findMaster(file.contents.toString('utf-8'))
    if (!masterRelativePath) {
        afterExtend()
        return
    }

    var masterAbsolute = path.join(path.dirname(file.path), masterRelativePath)

    makeFile(masterAbsolute, function (masterFile) {

        extendFile(masterFile, function () {

            var masterContent = masterFile.contents.toString()
            var lines = masterContent.split(/\n|\r|\r\n/)

            var newLines = lines.map(function (line, index, array) {
                var blockName = findPlaceholder(line)
                if (blockName) {
                    var blockContent = getBlockContent(file.contents.toString(), blockName)
                    return blockContent || line
                } else {
                    return line
                }
            })

            var newContent = newLines.join('\n')

            file.contents = new Buffer(newContent)

            return afterExtend()

        })

    })

}

function findMaster(string) {
    var regex = /<!--\s*@@master=\s*(\S+)\s*-->/
    var match = string.match(regex)
    return match ? match[1] : null

}

function findPlaceholder(string) {
    var regex = /<!--\s*@@placeholder=\s*(\S+)\s*-->/
    var match = string.match(regex)
    return match ? match[1] : null
}

function getBlockContent(string, blockName) {
    var result = ''
    var lines = splitByLine(string)
    var inBlock = false
    var regex = new RegExp('<!--\\s*@@block=\\s*' + blockName + '\\s*-->')

    return [ '<!-- start ' + blockName + ' -->',
        lines.reduce(function (prev, current) {
            if (inBlock) {
                var matchEnd = /<!--\s*@@close\s*-->/.test(current)
                if (matchEnd) {
                    inBlock = false
                    return prev
                }
                return prev + (prev === '' ? '' : '\n') + current
            }
            var matchBegin = regex.test(current)
            if (matchBegin) {
                inBlock = true
                return prev
            } else {
                return prev
            }
        }, ''),
            '\n<!-- end ' + blockName + ' -->'
    ].join('\n')
}

function splitByLine(string) {
    return string.split(/\n|\r|\r\n/)
}

