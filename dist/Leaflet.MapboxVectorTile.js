(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","ieee754":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","is-array":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js":[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js":[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/index.js":[function(require,module,exports){
(function (Buffer){
'use strict';

var ieee754 = require('ieee754');

module.exports = Protobuf;
function Protobuf(buf) {
    this.buf = buf;
    this.pos = 0;
}

Protobuf.prototype = {
    get length() { return this.buf.length; }
};

Protobuf.Varint = 0;
Protobuf.Int64 = 1;
Protobuf.Message = 2;
Protobuf.String = 2;
Protobuf.Packed = 2;
Protobuf.Int32 = 5;

Protobuf.prototype.destroy = function() {
    this.buf = null;
};

// === READING =================================================================

Protobuf.prototype.readUInt32 = function() {
    var val = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return val;
};

Protobuf.prototype.readUInt64 = function() {
    var val = this.buf.readUInt64LE(this.pos);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readDouble = function() {
    var val = ieee754.read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readVarint = function() {
    // TODO: bounds checking
    var pos = this.pos;
    if (this.buf[pos] <= 0x7f) {
        this.pos++;
        return this.buf[pos];
    } else if (this.buf[pos + 1] <= 0x7f) {
        this.pos += 2;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] << 7);
    } else if (this.buf[pos + 2] <= 0x7f) {
        this.pos += 3;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2]) << 14;
    } else if (this.buf[pos + 3] <= 0x7f) {
        this.pos += 4;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21;
    } else if (this.buf[pos + 4] <= 0x7f) {
        this.pos += 5;
        return ((this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21) + (this.buf[pos + 4] * 268435456);
    } else {
        this.skip(Protobuf.Varint);
        return 0;
        // throw new Error("TODO: Handle 6+ byte varints");
    }
};

Protobuf.prototype.readSVarint = function() {
    var num = this.readVarint();
    if (num > 2147483647) throw new Error('TODO: Handle numbers >= 2^30');
    // zigzag encoding
    return ((num >> 1) ^ -(num & 1));
};

Protobuf.prototype.readString = function() {
    var bytes = this.readVarint();
    // TODO: bounds checking
    var chr = String.fromCharCode;
    var b = this.buf;
    var p = this.pos;
    var end = this.pos + bytes;
    var str = '';
    while (p < end) {
        if (b[p] <= 0x7F) str += chr(b[p++]);
        else if (b[p] <= 0xBF) throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
        else if (b[p] <= 0xDF) str += chr((b[p++] & 0x1F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xEF) str += chr((b[p++] & 0x1F) << 12 | (b[p++] & 0x3F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xF7) p += 4; // We can't handle these codepoints in JS, so skip.
        else if (b[p] <= 0xFB) p += 5;
        else if (b[p] <= 0xFD) p += 6;
        else throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
    }
    this.pos += bytes;
    return str;
};

Protobuf.prototype.readBuffer = function() {
    var bytes = this.readVarint();
    var buffer = this.buf.subarray(this.pos, this.pos + bytes);
    this.pos += bytes;
    return buffer;
};

Protobuf.prototype.readPacked = function(type) {
    // TODO: bounds checking
    var bytes = this.readVarint();
    var end = this.pos + bytes;
    var array = [];
    while (this.pos < end) {
        array.push(this['read' + type]());
    }
    return array;
};

Protobuf.prototype.skip = function(val) {
    // TODO: bounds checking
    var type = val & 0x7;
    switch (type) {
        /* varint */ case Protobuf.Varint: while (this.buf[this.pos++] > 0x7f); break;
        /* 64 bit */ case Protobuf.Int64: this.pos += 8; break;
        /* length */ case Protobuf.Message: var bytes = this.readVarint(); this.pos += bytes; break;
        /* 32 bit */ case Protobuf.Int32: this.pos += 4; break;
        default: throw new Error('Unimplemented type: ' + type);
    }
};

// === WRITING =================================================================

Protobuf.prototype.writeTag = function(tag, type) {
    this.writeVarint((tag << 3) | type);
};

Protobuf.prototype.realloc = function(min) {
    var length = this.buf.length;
    while (length < this.pos + min) length *= 2;
    if (length != this.buf.length) {
        var buf = new Buffer(length);
        this.buf.copy(buf);
        this.buf = buf;
    }
};

Protobuf.prototype.finish = function() {
    return this.buf.slice(0, this.pos);
};

Protobuf.prototype.writePacked = function(type, tag, items) {
    if (!items.length) return;

    var message = new Protobuf();
    for (var i = 0; i < items.length; i++) {
        message['write' + type](items[i]);
    }
    var data = message.finish();

    this.writeTag(tag, Protobuf.Packed);
    this.writeBuffer(data);
};

Protobuf.prototype.writeUInt32 = function(val) {
    this.realloc(4);
    this.buf.writeUInt32LE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedUInt32 = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeUInt32(val);
};

Protobuf.prototype.writeVarint = function(val) {
    val = Number(val);
    if (isNaN(val)) {
        val = 0;
    }

    if (val <= 0x7f) {
        this.realloc(1);
        this.buf[this.pos++] = val;
    } else if (val <= 0x3fff) {
        this.realloc(2);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 7) & 0x7f);
    } else if (val <= 0x1ffffff) {
        this.realloc(3);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 14) & 0x7f);
    } else if (val <= 0xfffffff) {
        this.realloc(4);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 14) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 21) & 0x7f);
    } else {
        while (val > 0) {
            var b = val & 0x7f;
            val = Math.floor(val / 128);
            if (val > 0) b |= 0x80
            this.realloc(1);
            this.buf[this.pos++] = b;
        }
    }
};

Protobuf.prototype.writeTaggedVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeVarint(val);
};

Protobuf.prototype.writeSVarint = function(val) {
    if (val >= 0) {
        this.writeVarint(val * 2);
    } else {
        this.writeVarint(val * -2 - 1);
    }
};

Protobuf.prototype.writeTaggedSVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeSVarint(val);
};

Protobuf.prototype.writeBoolean = function(val) {
    this.writeVarint(Boolean(val));
};

Protobuf.prototype.writeTaggedBoolean = function(tag, val) {
    this.writeTaggedVarint(tag, Boolean(val));
};

Protobuf.prototype.writeString = function(str) {
    str = String(str);
    var bytes = Buffer.byteLength(str);
    this.writeVarint(bytes);
    this.realloc(bytes);
    this.buf.write(str, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedString = function(tag, str) {
    this.writeTag(tag, Protobuf.String);
    this.writeString(str);
};

Protobuf.prototype.writeFloat = function(val) {
    this.realloc(4);
    this.buf.writeFloatLE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedFloat = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeFloat(val);
};

Protobuf.prototype.writeDouble = function(val) {
    this.realloc(8);
    this.buf.writeDoubleLE(val, this.pos);
    this.pos += 8;
};

Protobuf.prototype.writeTaggedDouble = function(tag, val) {
    this.writeTag(tag, Protobuf.Int64);
    this.writeDouble(val);
};

Protobuf.prototype.writeBuffer = function(buffer) {
    var bytes = buffer.length;
    this.writeVarint(bytes);
    this.realloc(bytes);
    buffer.copy(this.buf, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedBuffer = function(tag, buffer) {
    this.writeTag(tag, Protobuf.String);
    this.writeBuffer(buffer);
};

Protobuf.prototype.writeMessage = function(tag, protobuf) {
    var buffer = protobuf.finish();
    this.writeTag(tag, Protobuf.Message);
    this.writeBuffer(buffer);
};

}).call(this,require("buffer").Buffer)
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9wYmYvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3RvYnVmO1xuZnVuY3Rpb24gUHJvdG9idWYoYnVmKSB7XG4gICAgdGhpcy5idWYgPSBidWY7XG4gICAgdGhpcy5wb3MgPSAwO1xufVxuXG5Qcm90b2J1Zi5wcm90b3R5cGUgPSB7XG4gICAgZ2V0IGxlbmd0aCgpIHsgcmV0dXJuIHRoaXMuYnVmLmxlbmd0aDsgfVxufTtcblxuUHJvdG9idWYuVmFyaW50ID0gMDtcblByb3RvYnVmLkludDY0ID0gMTtcblByb3RvYnVmLk1lc3NhZ2UgPSAyO1xuUHJvdG9idWYuU3RyaW5nID0gMjtcblByb3RvYnVmLlBhY2tlZCA9IDI7XG5Qcm90b2J1Zi5JbnQzMiA9IDU7XG5cblByb3RvYnVmLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5idWYgPSBudWxsO1xufTtcblxuLy8gPT09IFJFQURJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRVSW50MzIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gdGhpcy5idWYucmVhZFVJbnQzMkxFKHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA0O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFVJbnQ2NCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWwgPSB0aGlzLmJ1Zi5yZWFkVUludDY0TEUodGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG4gICAgcmV0dXJuIHZhbDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkRG91YmxlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZhbCA9IGllZWU3NTQucmVhZCh0aGlzLmJ1ZiwgdGhpcy5wb3MsIHRydWUsIDUyLCA4KTtcbiAgICB0aGlzLnBvcyArPSA4O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBwb3MgPSB0aGlzLnBvcztcbiAgICBpZiAodGhpcy5idWZbcG9zXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zKys7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1Zltwb3NdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgMV0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSAyO1xuICAgICAgICByZXR1cm4gKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSA8PCA3KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDJdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gMztcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdKSA8PCAxNDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDNdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gNDtcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgNF0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSA1O1xuICAgICAgICByZXR1cm4gKCh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxKSArICh0aGlzLmJ1Zltwb3MgKyA0XSAqIDI2ODQzNTQ1Nik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5za2lwKFByb3RvYnVmLlZhcmludCk7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoXCJUT0RPOiBIYW5kbGUgNisgYnl0ZSB2YXJpbnRzXCIpO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkU1ZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBudW0gPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICBpZiAobnVtID4gMjE0NzQ4MzY0NykgdGhyb3cgbmV3IEVycm9yKCdUT0RPOiBIYW5kbGUgbnVtYmVycyA+PSAyXjMwJyk7XG4gICAgLy8gemlnemFnIGVuY29kaW5nXG4gICAgcmV0dXJuICgobnVtID4+IDEpIF4gLShudW0gJiAxKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBjaHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuICAgIHZhciBiID0gdGhpcy5idWY7XG4gICAgdmFyIHAgPSB0aGlzLnBvcztcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgd2hpbGUgKHAgPCBlbmQpIHtcbiAgICAgICAgaWYgKGJbcF0gPD0gMHg3Rikgc3RyICs9IGNocihiW3ArK10pO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4QkYpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVVEYtOCBjb2RlcG9pbnQ6ICcgKyBiW3BdKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweERGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEVGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCAxMiB8IChiW3ArK10gJiAweDNGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEY3KSBwICs9IDQ7IC8vIFdlIGNhbid0IGhhbmRsZSB0aGVzZSBjb2RlcG9pbnRzIGluIEpTLCBzbyBza2lwLlxuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RkIpIHAgKz0gNTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEZEKSBwICs9IDY7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVURi04IGNvZGVwb2ludDogJyArIGJbcF0pO1xuICAgIH1cbiAgICB0aGlzLnBvcyArPSBieXRlcztcbiAgICByZXR1cm4gc3RyO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5idWYuc3ViYXJyYXkodGhpcy5wb3MsIHRoaXMucG9zICsgYnl0ZXMpO1xuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xuICAgIHJldHVybiBidWZmZXI7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFBhY2tlZCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgYXJyYXkgPSBbXTtcbiAgICB3aGlsZSAodGhpcy5wb3MgPCBlbmQpIHtcbiAgICAgICAgYXJyYXkucHVzaCh0aGlzWydyZWFkJyArIHR5cGVdKCkpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciB0eXBlID0gdmFsICYgMHg3O1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAvKiB2YXJpbnQgKi8gY2FzZSBQcm90b2J1Zi5WYXJpbnQ6IHdoaWxlICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA+IDB4N2YpOyBicmVhaztcbiAgICAgICAgLyogNjQgYml0ICovIGNhc2UgUHJvdG9idWYuSW50NjQ6IHRoaXMucG9zICs9IDg7IGJyZWFrO1xuICAgICAgICAvKiBsZW5ndGggKi8gY2FzZSBQcm90b2J1Zi5NZXNzYWdlOiB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTsgdGhpcy5wb3MgKz0gYnl0ZXM7IGJyZWFrO1xuICAgICAgICAvKiAzMiBiaXQgKi8gY2FzZSBQcm90b2J1Zi5JbnQzMjogdGhpcy5wb3MgKz0gNDsgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcignVW5pbXBsZW1lbnRlZCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxufTtcblxuLy8gPT09IFdSSVRJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnID0gZnVuY3Rpb24odGFnLCB0eXBlKSB7XG4gICAgdGhpcy53cml0ZVZhcmludCgodGFnIDw8IDMpIHwgdHlwZSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhbGxvYyA9IGZ1bmN0aW9uKG1pbikge1xuICAgIHZhciBsZW5ndGggPSB0aGlzLmJ1Zi5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aCA8IHRoaXMucG9zICsgbWluKSBsZW5ndGggKj0gMjtcbiAgICBpZiAobGVuZ3RoICE9IHRoaXMuYnVmLmxlbmd0aCkge1xuICAgICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgICB0aGlzLmJ1Zi5jb3B5KGJ1Zik7XG4gICAgICAgIHRoaXMuYnVmID0gYnVmO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5maW5pc2ggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5idWYuc2xpY2UoMCwgdGhpcy5wb3MpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlUGFja2VkID0gZnVuY3Rpb24odHlwZSwgdGFnLCBpdGVtcykge1xuICAgIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG5cbiAgICB2YXIgbWVzc2FnZSA9IG5ldyBQcm90b2J1ZigpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbWVzc2FnZVsnd3JpdGUnICsgdHlwZV0oaXRlbXNbaV0pO1xuICAgIH1cbiAgICB2YXIgZGF0YSA9IG1lc3NhZ2UuZmluaXNoKCk7XG5cbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuUGFja2VkKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGRhdGEpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVUludDMyID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgIHRoaXMuYnVmLndyaXRlVUludDMyTEUodmFsLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gNDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFVJbnQzMiA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlVUludDMyKHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB2YWwgPSBOdW1iZXIodmFsKTtcbiAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICB2YWwgPSAwO1xuICAgIH1cblxuICAgIGlmICh2YWwgPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gdmFsO1xuICAgIH0gZWxzZSBpZiAodmFsIDw9IDB4M2ZmZikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAwKSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4MDAgfCAoKHZhbCA+Pj4gNykgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweDFmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDMpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHgwMCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweGZmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDAwIHwgKCh2YWwgPj4+IDIxKSAmIDB4N2YpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh2YWwgPiAwKSB7XG4gICAgICAgICAgICB2YXIgYiA9IHZhbCAmIDB4N2Y7XG4gICAgICAgICAgICB2YWwgPSBNYXRoLmZsb29yKHZhbCAvIDEyOCk7XG4gICAgICAgICAgICBpZiAodmFsID4gMCkgYiB8PSAweDgwXG4gICAgICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IGI7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRWYXJpbnQgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5WYXJpbnQpO1xuICAgIHRoaXMud3JpdGVWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVNWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICBpZiAodmFsID49IDApIHtcbiAgICAgICAgdGhpcy53cml0ZVZhcmludCh2YWwgKiAyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLndyaXRlVmFyaW50KHZhbCAqIC0yIC0gMSk7XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkU1ZhcmludCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlZhcmludCk7XG4gICAgdGhpcy53cml0ZVNWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZUJvb2xlYW4gPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLndyaXRlVmFyaW50KEJvb2xlYW4odmFsKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCb29sZWFuID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnZ2VkVmFyaW50KHRhZywgQm9vbGVhbih2YWwpKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVN0cmluZyA9IGZ1bmN0aW9uKHN0cikge1xuICAgIHN0ciA9IFN0cmluZyhzdHIpO1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN0cik7XG4gICAgdGhpcy53cml0ZVZhcmludChieXRlcyk7XG4gICAgdGhpcy5yZWFsbG9jKGJ5dGVzKTtcbiAgICB0aGlzLmJ1Zi53cml0ZShzdHIsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSBieXRlcztcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFN0cmluZyA9IGZ1bmN0aW9uKHRhZywgc3RyKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlN0cmluZyk7XG4gICAgdGhpcy53cml0ZVN0cmluZyhzdHIpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlRmxvYXQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLnJlYWxsb2MoNCk7XG4gICAgdGhpcy5idWYud3JpdGVGbG9hdExFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDQ7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRGbG9hdCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlRmxvYXQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZURvdWJsZSA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMucmVhbGxvYyg4KTtcbiAgICB0aGlzLmJ1Zi53cml0ZURvdWJsZUxFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWREb3VibGUgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5JbnQ2NCk7XG4gICAgdGhpcy53cml0ZURvdWJsZSh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgdmFyIGJ5dGVzID0gYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLndyaXRlVmFyaW50KGJ5dGVzKTtcbiAgICB0aGlzLnJlYWxsb2MoYnl0ZXMpO1xuICAgIGJ1ZmZlci5jb3B5KHRoaXMuYnVmLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCdWZmZXIgPSBmdW5jdGlvbih0YWcsIGJ1ZmZlcikge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5TdHJpbmcpO1xuICAgIHRoaXMud3JpdGVCdWZmZXIoYnVmZmVyKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZU1lc3NhZ2UgPSBmdW5jdGlvbih0YWcsIHByb3RvYnVmKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHByb3RvYnVmLmZpbmlzaCgpO1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5NZXNzYWdlKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGJ1ZmZlcik7XG59O1xuIl19
},{"buffer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js","ieee754":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js":[function(require,module,exports){
'use strict';

module.exports = Point;

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype = {
    clone: function() { return new Point(this.x, this.y); },

    add:     function(p) { return this.clone()._add(p);     },
    sub:     function(p) { return this.clone()._sub(p);     },
    mult:    function(k) { return this.clone()._mult(k);    },
    div:     function(k) { return this.clone()._div(k);     },
    rotate:  function(a) { return this.clone()._rotate(a);  },
    matMult: function(m) { return this.clone()._matMult(m); },
    unit:    function() { return this.clone()._unit(); },
    perp:    function() { return this.clone()._perp(); },
    round:   function() { return this.clone()._round(); },

    mag: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    equals: function(p) {
        return this.x === p.x &&
               this.y === p.y;
    },

    dist: function(p) {
        return Math.sqrt(this.distSqr(p));
    },

    distSqr: function(p) {
        var dx = p.x - this.x,
            dy = p.y - this.y;
        return dx * dx + dy * dy;
    },

    angle: function() {
        return Math.atan2(this.y, this.x);
    },

    angleTo: function(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
    },

    angleWith: function(b) {
        return this.angleWithSep(b.x, b.y);
    },

    // Find the angle of the two vectors, solving the formula for the cross product a x b = |a||b|sin(θ) for θ.
    angleWithSep: function(x, y) {
        return Math.atan2(
            this.x * y - this.y * x,
            this.x * x + this.y * y);
    },

    _matMult: function(m) {
        var x = m[0] * this.x + m[1] * this.y,
            y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _add: function(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
    },

    _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
    },

    _mult: function(k) {
        this.x *= k;
        this.y *= k;
        return this;
    },

    _div: function(k) {
        this.x /= k;
        this.y /= k;
        return this;
    },

    _unit: function() {
        this._div(this.mag());
        return this;
    },

    _perp: function() {
        var y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
    },

    _rotate: function(angle) {
        var cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = cos * this.x - sin * this.y,
            y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _round: function() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
};

// constructs Point from an array if necessary
Point.convert = function (a) {
    if (a instanceof Point) {
        return a;
    }
    if (Array.isArray(a)) {
        return new Point(a[0], a[1]);
    }
    return a;
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/rbush/rbush.js":[function(require,module,exports){
/*
 (c) 2015, Vladimir Agafonkin
 RBush, a JavaScript library for high-performance 2D spatial indexing of points and rectangles.
 https://github.com/mourner/rbush
*/

(function () { 'use strict';

function rbush(maxEntries, format) {

    // jshint newcap: false, validthis: true
    if (!(this instanceof rbush)) return new rbush(maxEntries, format);

    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries || 9);
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));

    if (format) {
        this._initFormat(format);
    }

    this.clear();
}

rbush.prototype = {

    all: function () {
        return this._all(this.data, []);
    },

    search: function (bbox) {

        var node = this.data,
            result = [],
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return result;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf) result.push(child);
                    else if (contains(bbox, childBBox)) this._all(child, result);
                    else nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return result;
    },

    collides: function (bbox) {

        var node = this.data,
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return false;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf || contains(bbox, childBBox)) return true;
                    nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return false;
    },

    load: function (data) {
        if (!(data && data.length)) return this;

        if (data.length < this._minEntries) {
            for (var i = 0, len = data.length; i < len; i++) {
                this.insert(data[i]);
            }
            return this;
        }

        // recursively build the tree with the given data from stratch using OMT algorithm
        var node = this._build(data.slice(), 0, data.length - 1, 0);

        if (!this.data.children.length) {
            // save as is if tree is empty
            this.data = node;

        } else if (this.data.height === node.height) {
            // split root if trees have the same height
            this._splitRoot(this.data, node);

        } else {
            if (this.data.height < node.height) {
                // swap trees if inserted one is bigger
                var tmpNode = this.data;
                this.data = node;
                node = tmpNode;
            }

            // insert the small tree into the large tree at appropriate level
            this._insert(node, this.data.height - node.height - 1, true);
        }

        return this;
    },

    insert: function (item) {
        if (item) this._insert(item, this.data.height - 1);
        return this;
    },

    clear: function () {
        this.data = {
            children: [],
            height: 1,
            bbox: empty(),
            leaf: true
        };
        return this;
    },

    remove: function (item) {
        if (!item) return this;

        var node = this.data,
            bbox = this.toBBox(item),
            path = [],
            indexes = [],
            i, parent, index, goingUp;

        // depth-first iterative tree traversal
        while (node || path.length) {

            if (!node) { // go up
                node = path.pop();
                parent = path[path.length - 1];
                i = indexes.pop();
                goingUp = true;
            }

            if (node.leaf) { // check current node
                index = node.children.indexOf(item);

                if (index !== -1) {
                    // item found, remove the item and condense tree upwards
                    node.children.splice(index, 1);
                    path.push(node);
                    this._condense(path);
                    return this;
                }
            }

            if (!goingUp && !node.leaf && contains(node.bbox, bbox)) { // go down
                path.push(node);
                indexes.push(i);
                i = 0;
                parent = node;
                node = node.children[0];

            } else if (parent) { // go right
                i++;
                node = parent.children[i];
                goingUp = false;

            } else node = null; // nothing found
        }

        return this;
    },

    toBBox: function (item) { return item; },

    compareMinX: function (a, b) { return a[0] - b[0]; },
    compareMinY: function (a, b) { return a[1] - b[1]; },

    toJSON: function () { return this.data; },

    fromJSON: function (data) {
        this.data = data;
        return this;
    },

    _all: function (node, result) {
        var nodesToSearch = [];
        while (node) {
            if (node.leaf) result.push.apply(result, node.children);
            else nodesToSearch.push.apply(nodesToSearch, node.children);

            node = nodesToSearch.pop();
        }
        return result;
    },

    _build: function (items, left, right, height) {

        var N = right - left + 1,
            M = this._maxEntries,
            node;

        if (N <= M) {
            // reached leaf level; return leaf
            node = {
                children: items.slice(left, right + 1),
                height: 1,
                bbox: null,
                leaf: true
            };
            calcBBox(node, this.toBBox);
            return node;
        }

        if (!height) {
            // target height of the bulk-loaded tree
            height = Math.ceil(Math.log(N) / Math.log(M));

            // target number of root entries to maximize storage utilization
            M = Math.ceil(N / Math.pow(M, height - 1));
        }

        // TODO eliminate recursion?

        node = {
            children: [],
            height: height,
            bbox: null
        };

        // split the items into M mostly square tiles

        var N2 = Math.ceil(N / M),
            N1 = N2 * Math.ceil(Math.sqrt(M)),
            i, j, right2, right3;

        multiSelect(items, left, right, N1, this.compareMinX);

        for (i = left; i <= right; i += N1) {

            right2 = Math.min(i + N1 - 1, right);

            multiSelect(items, i, right2, N2, this.compareMinY);

            for (j = i; j <= right2; j += N2) {

                right3 = Math.min(j + N2 - 1, right2);

                // pack each entry recursively
                node.children.push(this._build(items, j, right3, height - 1));
            }
        }

        calcBBox(node, this.toBBox);

        return node;
    },

    _chooseSubtree: function (bbox, node, level, path) {

        var i, len, child, targetNode, area, enlargement, minArea, minEnlargement;

        while (true) {
            path.push(node);

            if (node.leaf || path.length - 1 === level) break;

            minArea = minEnlargement = Infinity;

            for (i = 0, len = node.children.length; i < len; i++) {
                child = node.children[i];
                area = bboxArea(child.bbox);
                enlargement = enlargedArea(bbox, child.bbox) - area;

                // choose entry with the least area enlargement
                if (enlargement < minEnlargement) {
                    minEnlargement = enlargement;
                    minArea = area < minArea ? area : minArea;
                    targetNode = child;

                } else if (enlargement === minEnlargement) {
                    // otherwise choose one with the smallest area
                    if (area < minArea) {
                        minArea = area;
                        targetNode = child;
                    }
                }
            }

            node = targetNode;
        }

        return node;
    },

    _insert: function (item, level, isNode) {

        var toBBox = this.toBBox,
            bbox = isNode ? item.bbox : toBBox(item),
            insertPath = [];

        // find the best node for accommodating the item, saving all nodes along the path too
        var node = this._chooseSubtree(bbox, this.data, level, insertPath);

        // put the item into the node
        node.children.push(item);
        extend(node.bbox, bbox);

        // split on node overflow; propagate upwards if necessary
        while (level >= 0) {
            if (insertPath[level].children.length > this._maxEntries) {
                this._split(insertPath, level);
                level--;
            } else break;
        }

        // adjust bboxes along the insertion path
        this._adjustParentBBoxes(bbox, insertPath, level);
    },

    // split overflowed node into two
    _split: function (insertPath, level) {

        var node = insertPath[level],
            M = node.children.length,
            m = this._minEntries;

        this._chooseSplitAxis(node, m, M);

        var splitIndex = this._chooseSplitIndex(node, m, M);

        var newNode = {
            children: node.children.splice(splitIndex, node.children.length - splitIndex),
            height: node.height
        };

        if (node.leaf) newNode.leaf = true;

        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);

        if (level) insertPath[level - 1].children.push(newNode);
        else this._splitRoot(node, newNode);
    },

    _splitRoot: function (node, newNode) {
        // split root node
        this.data = {
            children: [node, newNode],
            height: node.height + 1
        };
        calcBBox(this.data, this.toBBox);
    },

    _chooseSplitIndex: function (node, m, M) {

        var i, bbox1, bbox2, overlap, area, minOverlap, minArea, index;

        minOverlap = minArea = Infinity;

        for (i = m; i <= M - m; i++) {
            bbox1 = distBBox(node, 0, i, this.toBBox);
            bbox2 = distBBox(node, i, M, this.toBBox);

            overlap = intersectionArea(bbox1, bbox2);
            area = bboxArea(bbox1) + bboxArea(bbox2);

            // choose distribution with minimum overlap
            if (overlap < minOverlap) {
                minOverlap = overlap;
                index = i;

                minArea = area < minArea ? area : minArea;

            } else if (overlap === minOverlap) {
                // otherwise choose distribution with minimum area
                if (area < minArea) {
                    minArea = area;
                    index = i;
                }
            }
        }

        return index;
    },

    // sorts node children by the best axis for split
    _chooseSplitAxis: function (node, m, M) {

        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX,
            compareMinY = node.leaf ? this.compareMinY : compareNodeMinY,
            xMargin = this._allDistMargin(node, m, M, compareMinX),
            yMargin = this._allDistMargin(node, m, M, compareMinY);

        // if total distributions margin value is minimal for x, sort by minX,
        // otherwise it's already sorted by minY
        if (xMargin < yMargin) node.children.sort(compareMinX);
    },

    // total margin of all possible split distributions where each node is at least m full
    _allDistMargin: function (node, m, M, compare) {

        node.children.sort(compare);

        var toBBox = this.toBBox,
            leftBBox = distBBox(node, 0, m, toBBox),
            rightBBox = distBBox(node, M - m, M, toBBox),
            margin = bboxMargin(leftBBox) + bboxMargin(rightBBox),
            i, child;

        for (i = m; i < M - m; i++) {
            child = node.children[i];
            extend(leftBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(leftBBox);
        }

        for (i = M - m - 1; i >= m; i--) {
            child = node.children[i];
            extend(rightBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(rightBBox);
        }

        return margin;
    },

    _adjustParentBBoxes: function (bbox, path, level) {
        // adjust bboxes along the given tree path
        for (var i = level; i >= 0; i--) {
            extend(path[i].bbox, bbox);
        }
    },

    _condense: function (path) {
        // go through the path, removing empty nodes and updating bboxes
        for (var i = path.length - 1, siblings; i >= 0; i--) {
            if (path[i].children.length === 0) {
                if (i > 0) {
                    siblings = path[i - 1].children;
                    siblings.splice(siblings.indexOf(path[i]), 1);

                } else this.clear();

            } else calcBBox(path[i], this.toBBox);
        }
    },

    _initFormat: function (format) {
        // data format (minX, minY, maxX, maxY accessors)

        // uses eval-type function compilation instead of just accepting a toBBox function
        // because the algorithms are very sensitive to sorting functions performance,
        // so they should be dead simple and without inner calls

        // jshint evil: true

        var compareArr = ['return a', ' - b', ';'];

        this.compareMinX = new Function('a', 'b', compareArr.join(format[0]));
        this.compareMinY = new Function('a', 'b', compareArr.join(format[1]));

        this.toBBox = new Function('a', 'return [a' + format.join(', a') + '];');
    }
};


// calculate node's bbox from bboxes of its children
function calcBBox(node, toBBox) {
    node.bbox = distBBox(node, 0, node.children.length, toBBox);
}

// min bounding rectangle of node children from k to p-1
function distBBox(node, k, p, toBBox) {
    var bbox = empty();

    for (var i = k, child; i < p; i++) {
        child = node.children[i];
        extend(bbox, node.leaf ? toBBox(child) : child.bbox);
    }

    return bbox;
}

function empty() { return [Infinity, Infinity, -Infinity, -Infinity]; }

function extend(a, b) {
    a[0] = Math.min(a[0], b[0]);
    a[1] = Math.min(a[1], b[1]);
    a[2] = Math.max(a[2], b[2]);
    a[3] = Math.max(a[3], b[3]);
    return a;
}

function compareNodeMinX(a, b) { return a.bbox[0] - b.bbox[0]; }
function compareNodeMinY(a, b) { return a.bbox[1] - b.bbox[1]; }

function bboxArea(a)   { return (a[2] - a[0]) * (a[3] - a[1]); }
function bboxMargin(a) { return (a[2] - a[0]) + (a[3] - a[1]); }

function enlargedArea(a, b) {
    return (Math.max(b[2], a[2]) - Math.min(b[0], a[0])) *
           (Math.max(b[3], a[3]) - Math.min(b[1], a[1]));
}

function intersectionArea(a, b) {
    var minX = Math.max(a[0], b[0]),
        minY = Math.max(a[1], b[1]),
        maxX = Math.min(a[2], b[2]),
        maxY = Math.min(a[3], b[3]);

    return Math.max(0, maxX - minX) *
           Math.max(0, maxY - minY);
}

function contains(a, b) {
    return a[0] <= b[0] &&
           a[1] <= b[1] &&
           b[2] <= a[2] &&
           b[3] <= a[3];
}

function intersects(a, b) {
    return b[0] <= a[2] &&
           b[1] <= a[3] &&
           b[2] >= a[0] &&
           b[3] >= a[1];
}

// sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
// combines selection algorithm with binary divide & conquer approach

function multiSelect(arr, left, right, n, compare) {
    var stack = [left, right],
        mid;

    while (stack.length) {
        right = stack.pop();
        left = stack.pop();

        if (right - left <= n) continue;

        mid = left + Math.ceil((right - left) / n / 2) * n;
        select(arr, left, right, mid, compare);

        stack.push(left, mid, mid, right);
    }
}

// Floyd-Rivest selection algorithm:
// sort an array between left and right (inclusive) so that the smallest k elements come first (unordered)
function select(arr, left, right, k, compare) {
    var n, i, z, s, sd, newLeft, newRight, t, j;

    while (right > left) {
        if (right - left > 600) {
            n = right - left + 1;
            i = k - left + 1;
            z = Math.log(n);
            s = 0.5 * Math.exp(2 * z / 3);
            sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (i - n / 2 < 0 ? -1 : 1);
            newLeft = Math.max(left, Math.floor(k - i * s / n + sd));
            newRight = Math.min(right, Math.floor(k + (n - i) * s / n + sd));
            select(arr, newLeft, newRight, k, compare);
        }

        t = arr[k];
        i = left;
        j = right;

        swap(arr, left, k);
        if (compare(arr[right], t) > 0) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) i++;
            while (compare(arr[j], t) > 0) j--;
        }

        if (compare(arr[left], t) === 0) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}


// export as AMD/CommonJS module or global variable
if (typeof define === 'function' && define.amd) define('rbush', function() { return rbush; });
else if (typeof module !== 'undefined') module.exports = rbush;
else if (typeof self !== 'undefined') self.rbush = rbush;
else window.rbush = rbush;

})();

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js":[function(require,module,exports){
module.exports.VectorTile = require('./lib/vectortile.js');
module.exports.VectorTileFeature = require('./lib/vectortilefeature.js');
module.exports.VectorTileLayer = require('./lib/vectortilelayer.js');

},{"./lib/vectortile.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js","./lib/vectortilefeature.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js","./lib/vectortilelayer.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js":[function(require,module,exports){
'use strict';

var VectorTileLayer = require('./vectortilelayer');

module.exports = VectorTile;

function VectorTile(buffer, end) {

    this.layers = {};
    this._buffer = buffer;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 3) {
            var layer = this.readLayer();
            if (layer.length) this.layers[layer.name] = layer;
        } else {
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.readLayer = function() {
    var buffer = this._buffer,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        layer = new VectorTileLayer(buffer, end);

    buffer.pos = end;

    return layer;
};

},{"./vectortilelayer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js":[function(require,module,exports){
'use strict';

var Point = require('point-geometry');

module.exports = VectorTileFeature;

function VectorTileFeature(buffer, end, extent, keys, values) {

    this.properties = {};

    // Public
    this.extent = extent;
    this.type = 0;

    // Private
    this._buffer = buffer;
    this._geometry = -1;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 1) {
            this._id = buffer.readVarint();

        } else if (tag == 2) {
            var tagLen = buffer.readVarint(),
                tagEnd = buffer.pos + tagLen;

            while (buffer.pos < tagEnd) {
                var key = keys[buffer.readVarint()];
                var value = values[buffer.readVarint()];
                this.properties[key] = value;
            }

        } else if (tag == 3) {
            this.type = buffer.readVarint();

        } else if (tag == 4) {
            this._geometry = buffer.pos;
            buffer.skip(val);

        } else {
            buffer.skip(val);
        }
    }
}

VectorTileFeature.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

VectorTileFeature.prototype.loadGeometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        lines = [],
        line;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();

            if (cmd === 1) {
                // moveTo
                if (line) {
                    lines.push(line);
                }
                line = [];
            }

            line.push(new Point(x, y));
        } else if (cmd === 7) {
            // closePolygon
            line.push(line[0].clone());
        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (line) lines.push(line);

    return lines;
};

VectorTileFeature.prototype.bbox = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,

        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;

        } else if (cmd !== 7) {
            throw new Error('unknown command ' + cmd);
        }
    }

    return [x1, y1, x2, y2];
};

},{"point-geometry":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js":[function(require,module,exports){
'use strict';

var VectorTileFeature = require('./vectortilefeature.js');

module.exports = VectorTileLayer;
function VectorTileLayer(buffer, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    // Private
    this._buffer = buffer;
    this._keys = [];
    this._values = [];
    this._features = [];

    var val, tag;

    end = end || buffer.length;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag === 15) {
            this.version = buffer.readVarint();
        } else if (tag === 1) {
            this.name = buffer.readString();
        } else if (tag === 5) {
            this.extent = buffer.readVarint();
        } else if (tag === 2) {
            this.length++;
            this._features.push(buffer.pos);
            buffer.skip(val);

        } else if (tag === 3) {
            this._keys.push(buffer.readString());
        } else if (tag === 4) {
            this._values.push(this.readFeatureValue());
        } else {
            buffer.skip(val);
        }
    }
}

VectorTileLayer.prototype.readFeatureValue = function() {
    var buffer = this._buffer,
        value = null,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        val, tag;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            value = buffer.readString();
        } else if (tag == 2) {
            throw new Error('read float');
        } else if (tag == 3) {
            value = buffer.readDouble();
        } else if (tag == 4) {
            value = buffer.readVarint();
        } else if (tag == 5) {
            throw new Error('read uint');
        } else if (tag == 6) {
            value = buffer.readSVarint();
        } else if (tag == 7) {
            value = Boolean(buffer.readVarint());
        } else {
            buffer.skip(val);
        }
    }

    return value;
};

// return feature `i` from this layer as a `VectorTileFeature`
VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;

    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};

},{"./vectortilefeature.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTFeature.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley, Daniel Duarte, and Nicholas Hallahan
 *    on 6/03/14.
 */
var Util = require('./MVTUtil');
var StaticLabel = require('./StaticLabel/StaticLabel.js');

module.exports = MVTFeature;

function MVTFeature(mvtLayer, vtf, ctx, id, style) {
  if (!vtf) return null;

  // Apply all of the properties of vtf to this object.
  for (var key in vtf) {
    // Ignore private fields.
    if (key.charAt(0) !== '_') {
      this[key] = vtf[key];
    }
  }

  this.mvtLayer = mvtLayer;
  this.mvtSource = mvtLayer.mvtSource;
  this.map = mvtLayer.mvtSource.map;

  this.id = id;

  this.layerLink = this.mvtSource.layerLink;
  this.toggleEnabled = true;
  this.selected = false;

  // how much we divide the coordinate from the vector tile
  this.divisor = vtf.extent / ctx.tileSize;
  this.extent = vtf.extent;
  this.tileSize = ctx.tileSize;

  //An object to store the paths and contexts for this feature
  this.tiles = {};

  // TODO: think about this design
  this.mvtLayer.imgCache = this.mvtLayer.imgCache || {};

  this.style = style;

  //Add to the collection
  this.addTileFeature(vtf, ctx);

  this.map.on('zoomend', this._zoomend, this);
  var self = this;
  mvtLayer.on('remove', function() {
    self.map.off('zoomend', self._zoomend, self);
  });

  if (style && style.dynamicLabel && typeof style.dynamicLabel === 'function') {
    this.dynamicLabel = this.mvtSource.dynamicLabel.createFeature(this);
  }

  ajax(this);
}


function ajax(self) {
  var style = self.style;
  if (style && style.ajaxSource && typeof style.ajaxSource === 'function') {
    var ajaxEndpoint = style.ajaxSource(self);
    if (ajaxEndpoint) {
      Util.getJSON(ajaxEndpoint, function(error, response, body) {
        if (error) {
          throw ['ajaxSource AJAX Error', error];
        } else {
          ajaxCallback(self, response);
          return true;
        }
      });
    }
  }
  return false;
}

function ajaxCallback(self, response) {
  self.ajaxData = response;

  /**
   * You can attach a callback function to a feature in your app
   * that will get called whenever new ajaxData comes in. This
   * can be used to update UI that looks at data from within a feature.
   *
   * setStyle may possibly have a style with a different ajaxData source,
   * and you would potentially get new contextual data for your feature.
   *
   * TODO: This needs to be documented.
   */
  if (typeof self.ajaxDataReceived === 'function') {
    self.ajaxDataReceived(self, response);
  }

  self._setStyle(self.mvtLayer.style);
  this.redraw();
}

MVTFeature.prototype._setStyle = function(styleFn) {
  this.style = styleFn(this, this.ajaxData);

  // The label gets removed, and the (re)draw,
  // that is initiated by the MVTLayer creates a new label.
  this.removeLabel();
};

MVTFeature.prototype.setStyle = function(styleFn) {
  this.ajaxData = null;
  this.style = styleFn(this, null);
  var hasAjaxSource = ajax(this);
  if (!hasAjaxSource) {
    // The label gets removed, and the (re)draw,
    // that is initiated by the MVTLayer creates a new label.
    this.removeLabel();
  }
};

MVTFeature.prototype.draw = function(canvasID) {
  //Get the info from the tiles list
  var tileInfo =  this.tiles[canvasID];

  var vtf = tileInfo.vtf;
  var ctx = tileInfo.ctx;

  //Get the actual canvas from the parent layer's _tiles object.
  var xy = canvasID.split(":").slice(1, 3).join(":");
  ctx.canvas = this.mvtLayer._tiles[xy];

//  This could be used to directly compute the style function from the layer on every draw.
//  This is much less efficient...
//  this.style = this.mvtLayer.style(this);

  if (this.selected) {
    var style = this.style.selected || this.style;
  } else {
    var style = this.style;
  }

  switch (vtf.type) {
    case 1: //Point
      this._drawPoint(ctx, vtf.coordinates, style);
      if (!this.staticLabel && typeof this.style.staticLabel === 'function') {
        if (this.style.ajaxSource && !this.ajaxData) {
          break;
        }
        this._drawStaticLabel(ctx, vtf.coordinates, style);
      }
      break;

    case 2: //LineString
      this._drawLineString(ctx, vtf.coordinates, style);
      break;

    case 3: //Polygon
      this._drawPolygon(ctx, vtf.coordinates, style);
      break;

    default:
      throw new Error('Unmanaged type: ' + vtf.type);
  }

};

MVTFeature.prototype.getPathsForTile = function(canvasID) {
  var tile = this.tiles[canvasID];
  if (tile) {
    return tile.paths;
  } else {
    return [];
  }
};

MVTFeature.prototype.addTileFeature = function(vtf, ctx) {
  //Store the important items in the tiles list

  //We only want to store info for tiles for the current map zoom.  If it is tile info for another zoom level, ignore it
  //Also, if there are existing tiles in the list for other zoom levels, expunge them.
  var zoom = this.map.getZoom();

  if(ctx.zoom != zoom) return;

  this.tiles[ctx.id] = {
    ctx: ctx,
    vtf: vtf,
    paths: []
  };

};


/**
 * Clear the inner list of tile features if they don't match the given zoom.
 *
 * @param zoom
 */
MVTFeature.prototype.clearTileFeatures = function(zoom) {
  //If stored tiles exist for other zoom levels, expunge them from the list.
  for (var key in this.tiles) {
     if(key.split(":")[0] != zoom) delete this.tiles[key];
  }
};

/**
 * Redraws all of the tiles associated with a feature. Useful for
 * style change and toggling.
 */
MVTFeature.prototype.redraw = function() {
  //Redraw the whole tile, not just this vtf
  for (var id in this.tiles) {
    var tileZoom = parseInt(id.split(':')[0]);
    var mapZoom = this.map.getZoom();
    if (tileZoom === mapZoom) {
      //Redraw the tile
      this.mvtLayer.redrawTile(id);
    }
  }
}

MVTFeature.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

MVTFeature.prototype.select = function() {
  this.selected = true;
  this.mvtSource.featureSelected(this);
  this.redraw();
  var linkedFeature = this.linkedFeature();
  if (linkedFeature && linkedFeature.staticLabel && !linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.select();
  }
};

MVTFeature.prototype.deselect = function() {
  this.selected = false;
  this.mvtSource.featureDeselected(this);
  this.redraw();
  var linkedFeature = this.linkedFeature();
  if (linkedFeature && linkedFeature.staticLabel && linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.deselect();
  }
};

MVTFeature.prototype.on = function(eventType, callback) {
  this._eventHandlers[eventType] = callback;
};

MVTFeature.prototype._drawPoint = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;

  var tile = this.tiles[ctx.id];

  var p = this._tilePoint(coordsArray[0][0]);
  var c = ctx.canvas;
  var ctx2d;

  try {
    ctx2d = c.getContext('2d');
  }
  catch(e) {
    console.log("_drawPoint error: " + e);
    return;
  }

  // Save and render feature w/ specified alpha
  var preAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = style.opacity || preAlpha;

  if ('iconUrl' in style){
    this._drawPointIcon(ctx, ctx2d, p, style); 
  } else {
    this._drawPointCircle(ctx, ctx2d, p, style);
  }

  ctx2d.globalAlpha = preAlpha;
  tile.paths.push([p]);
};

MVTFeature.prototype._drawPointCircle = function(ctx, ctx2d, p, style) {
   

  //Get radius
  var radius = 1;
  if (typeof style.radius === 'function') {
    radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
  }
  else{
    radius = style.radius;
  }

  ctx2d.beginPath();
  ctx2d.fillStyle = style.color;
  ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx2d.closePath();
  ctx2d.fill();

  if(style.lineWidth && style.strokeStyle){
    ctx2d.lineWidth = style.lineWidth;
    ctx2d.strokeStyle = style.strokeStyle;
    ctx2d.stroke();
  }

  ctx2d.restore();
};

MVTFeature.prototype._drawPointIcon = function(ctx, ctx2d, p, style){

    var url = style.iconUrl;
    var img;
    if (!(url in this.mvtLayer.imgCache)){
        img = new Image();
        img.src = url;
        this.mvtLayer.imgCache[url] = img;
    } else {
        img = this.mvtLayer.imgCache[url];
    }

    //Get radius
    var radius = 1;
    if (typeof style.radius === 'function') {
      radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
    }
    else {
      radius = style.radius;
    }

    if (img.complete){
        ctx2d.drawImage(img, p.x - radius, p.y - radius, radius*2, radius*2);
    } else {
        (function(x,y){
            $(img).load(function(){
                ctx2d.drawImage(this, x - radius, y - radius, radius*2, radius*2);
            });
        })(p.x, p.y);
    }
}

MVTFeature.prototype._drawLineString = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;

  // Save and render feature w/ specified alpha
  var preAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = style.opacity || preAlpha;

  var ctx2d = ctx.canvas.getContext('2d');
  ctx2d.strokeStyle = style.color;
  ctx2d.lineWidth = style.size;
  ctx2d.beginPath();

  var projCoords = [];
  var tile = this.tiles[ctx.id];

  for (var gidx in coordsArray) {
    var coords = coordsArray[gidx];

    for (i = 0; i < coords.length; i++) {
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      ctx2d[method](proj.x, proj.y);
    }
  }

  ctx2d.stroke();
  ctx2d.restore();
  ctx2d.globalAlpha = preAlpha;

  tile.paths.push(projCoords);
};

MVTFeature.prototype._drawPolygon = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;
  console.log("MVTFeature: style is " + JSON.stringify(style));

  var ctx2d = ctx.canvas.getContext('2d');

  // Save and render feature w/ specified alpha
  var preAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = style.opacity || preAlpha;

  var outline = style.outline;

  // color may be defined via function to make choropleth work right
  if (typeof style.color === 'function') {
    ctx2d.fillStyle = style.color(ctx2d);
  } else {
    ctx2d.fillStyle = style.color;
  }

  if (outline) {
    ctx2d.strokeStyle = outline.color;
    ctx2d.lineWidth = outline.size;
  }
  ctx2d.beginPath();

  var projCoords = [];
  var tile = this.tiles[ctx.id];

  var featureLabel = this.dynamicLabel;
  if (featureLabel) {
    featureLabel.addTilePolys(ctx, coordsArray);
  }

  for (var gidx = 0, len = coordsArray.length; gidx < len; gidx++) {
    var coords = coordsArray[gidx];

    for (var i = 0; i < coords.length; i++) {
      var coord = coords[i];
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      ctx2d[method](proj.x, proj.y);
    }
  }

  ctx2d.closePath();
  ctx2d.fill();
  if (outline) {
    ctx2d.stroke();
  }
  // Restore alpha
  ctx2d.globalAlpha = preAlpha;

  tile.paths.push(projCoords);
};

MVTFeature.prototype._drawStaticLabel = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx) return;

  // If the corresponding layer is not on the map, 
  // we dont want to put on a label.
  if (!this.mvtLayer._map) return;

  var vecPt = this._tilePoint(coordsArray[0][0]);

  // We're making a standard Leaflet Marker for this label.
  var p = this._project(vecPt, ctx.tile.x, ctx.tile.y, this.extent, this.tileSize); //vectile pt to merc pt
  var mercPt = L.point(p.x, p.y); // make into leaflet obj
  var latLng = this.map.unproject(mercPt); // merc pt to latlng

  this.staticLabel = new StaticLabel(this, ctx, latLng, style);
  this.mvtLayer.featureWithLabelAdded(this);
};

MVTFeature.prototype.removeLabel = function() {
  if (!this.staticLabel) return;
  this.staticLabel.remove();
  this.staticLabel = null;
};

MVTFeature.prototype._zoomend = function() {
  this.removeLabel();
  this.clearTileFeatures(this.map.getZoom());
};

/**
 * Projects a vector tile point to the Spherical Mercator pixel space for a given zoom level.
 *
 * @param vecPt
 * @param tileX
 * @param tileY
 * @param extent
 * @param tileSize
 */
MVTFeature.prototype._project = function(vecPt, tileX, tileY, extent, tileSize) {
  var xOffset = tileX * tileSize;
  var yOffset = tileY * tileSize;
  return {
    x: Math.floor(vecPt.x + xOffset),
    y: Math.floor(vecPt.y + yOffset)
  };
};

/**
 * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
 *
 * @param ctx
 * @param coords
 * @returns {eGeomType.Point}
 * @private
 */
MVTFeature.prototype._tilePoint = function(coords) {
  return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
};

MVTFeature.prototype.linkedFeature = function() {
  var linkedLayer = this.mvtLayer.linkedLayer();
  if(linkedLayer){
    var linkedFeature = linkedLayer.features[this.id];
    return linkedFeature;
  }else{
    return null;
  }
};


},{"./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","./StaticLabel/StaticLabel.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTLayer.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley on 5/17/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/

var MVTFeature = require('./MVTFeature');

var Util = require('./MVTUtil');
var rbush = require('rbush');

module.exports = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256,
    lineClickTolerance: 2,
    buffer: 5,
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {
    if(poly && poly.length) {
      for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
      return c;
    }
  },

  _getDistanceFromLine: function(pt, pts) {
    var min = Number.POSITIVE_INFINITY;
    if (pts && pts.length > 1) {
      pt = L.point(pt.x, pt.y);
      for (var i = 0, l = pts.length - 1; i < l; i++) {
        var test = this._projectPointOnLineSegment(pt, pts[i], pts[i + 1]);
        if (test.distance <= min) {
          min = test.distance;
        }
      }
    }
    return min;
  },

  _projectPointOnLineSegment: function(p, r0, r1) {
    var lineLength = r0.distanceTo(r1);
    if (lineLength < 1) {
        return {distance: p.distanceTo(r0), coordinate: r0};
    }
    var u = ((p.x - r0.x) * (r1.x - r0.x) + (p.y - r0.y) * (r1.y - r0.y)) / Math.pow(lineLength, 2);
    if (u < 0.0000001) {
        return {distance: p.distanceTo(r0), coordinate: r0};
    }
    if (u > 0.9999999) {
        return {distance: p.distanceTo(r1), coordinate: r1};
    }
    var a = L.point(r0.x + u * (r1.x - r0.x), r0.y + u * (r1.y - r0.y));
    return {distance: p.distanceTo(a), point: a};
  },

  initialize: function(mvtSource, options) {
    var self = this;
    self.mvtSource = mvtSource;
    L.Util.setOptions(this, options);

    this.style = options.style;
    this.name = options.name;
    this._canvasIDToFeatures = {};
    this.features = {};
    this.featuresWithLabels = [];
    this._highestCount = 0;
  },

  onAdd: function(map) {
    this.map = map;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);
  },

  onRemove: function(map) {
    this.fire('remove');
    removeLabels(this);
    L.TileLayer.Canvas.prototype.onRemove.call(this, map);
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = Util.getContextID(ctx);

    if (!this._canvasIDToFeatures[ctx.id]) {
      this._initializeFeaturesHash(ctx);
    }
    if (!this.features) {
      this.features = {};
    }

  },

  _initializeFeaturesHash: function(ctx){
    this._canvasIDToFeatures[ctx.id] = {
      features: [],
      canvas: ctx.canvas,
      index: rbush(9)
    };
  },

  _draw: function(ctx) {
    //Draw is handled by the parent MVTSource object
  },
  getCanvas: function(parentCtx){
    //This gets called if a vector tile feature has already been parsed.
    //We've already got the geom, just get on with the drawing.
    //Need a way to pluck a canvas element from this layer given the parent layer's id.
    //Wait for it to get loaded before proceeding.
    var tilePoint = parentCtx.tile;
    var ctx = this._tiles[tilePoint.x + ":" + tilePoint.y];

    if(ctx){
      parentCtx.canvas = ctx;
      this.redrawTile(parentCtx.id);
      return;
    }

    var self = this;

    //This is a timer that will wait for a criterion to return true.
    //If not true within the timeout duration, it will move on.
    waitFor(function () {
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        if(ctx) {
          return true;
        }
      },
      function(){
        //When it finishes, do this.
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        parentCtx.canvas = ctx;
        self.redrawTile(parentCtx.id);

      }, //when done, go to next flow
      2000); //The Timeout milliseconds.  After this, give up and move on

  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;
    var layerCtx  = { canvas: null, id: ctx.id, tile: ctx.tile, zoom: ctx.zoom, tileSize: ctx.tileSize};

    //See if we can pluck the child tile from this PBF tile layer based on the master layer's tile id.
    layerCtx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Initialize this tile's feature storage hash, if it hasn't already been created.  Used for when filters are updated, and features are cleared to prepare for a fresh redraw.
    if (!this._canvasIDToFeatures[layerCtx.id]) {
      this._initializeFeaturesHash(layerCtx);
    }else{
      //Clear this tile's previously saved features.
      this.clearTileFeatureHash(layerCtx.id);
    }

    var features = vtl.parsedFeatures;
    var toIndex = [];
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i]; //vector tile feature

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.MVTSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, layerCtx) === false ) continue;
      }

      var getIDForLayerFeature;
      if (typeof self.options.getIDForLayerFeature === 'function') {
        getIDForLayerFeature = self.options.getIDForLayerFeature;
      } else {
        getIDForLayerFeature = Util.getIDForLayerFeature;
      }
      var uniqueID = self.options.getIDForLayerFeature(vtf) || i;
      var mvtFeature = self.features[uniqueID];

      /**
       * Index the feature by bounding box into rbush.
       */
      var buffer = 0;
      // add buffer to index for points (ignore for other types)
      if (vtf.type === 1) { buffer = self.options.buffer; }
      var box = bbox(vtf, layerCtx.tileSize, uniqueID, buffer);
      toIndex.push(box);

      /**
       * Use layerOrdering function to apply a zIndex property to each vtf.  This is defined in
       * TileLayer.MVTSource.js.  Used below to sort features.npm
       */
      var layerOrdering = self.options.layerOrdering;
      if (typeof layerOrdering === 'function') {
        layerOrdering(vtf, layerCtx); //Applies a custom property to the feature, which is used after we're thru iterating to sort
      }

      //Create a new MVTFeature if one doesn't already exist for this feature.
      if (!mvtFeature) {

        //Get a style for the feature - set it just once for each new MVTFeature
        var style = self.style(vtf);

        //create a new feature
        self.features[uniqueID] = mvtFeature = new MVTFeature(self, vtf, layerCtx, uniqueID, style);
        if (style && style.dynamicLabel && typeof style.dynamicLabel === 'function') {
          self.featuresWithLabels.push(mvtFeature);
        }
      } else {
        //Add the new part to the existing feature
        mvtFeature.addTileFeature(vtf, layerCtx);
      }

      //Associate & Save this feature with this tile for later
      self._canvasIDToFeatures[layerCtx.id].features.push(mvtFeature);

    }
    self._canvasIDToFeatures[layerCtx.id].index.load(toIndex);

    /**
     * Apply sorting (zIndex) on feature if there is a function defined in the options object
     * of TileLayer.MVTSource.js
     */
    var layerOrdering = self.options.layerOrdering;
    if (layerOrdering) {
      //We've assigned the custom zIndex property when iterating above.  Now just sort.
      self._canvasIDToFeatures[layerCtx.id].features = self._canvasIDToFeatures[layerCtx.id].features.sort(function(a, b) {
        return -(b.properties.zIndex - a.properties.zIndex)
      });
    }

    self.redrawTile(layerCtx.id);
  },

  setStyle: function(styleFn) {
    // refresh the number for the highest count value
    // this is used only for choropleth
    this._highestCount = 0;

    // lowest count should not be 0, since we want to figure out the lowest
    this._lowestCount = null;

    this.style = styleFn;
    for (var key in this.features) {
      var feat = this.features[key];
      feat.setStyle(styleFn);
    }
    var z = this.map.getZoom();
    for (var key in this._tiles) {
      var id = z + ':' + key;
      this.redrawTile(id);
    }
  },

  /**
   * As counts for choropleths come in with the ajax data,
   * we want to keep track of which value is the highest
   * to create the color ramp for the fills of polygons.
   * @param count
   */
  setHighestCount: function(count) {
    if (count > this._highestCount) {
      this._highestCount = count;
    }
  },

  /**
   * Returns the highest number of all of the counts that have come in
   * from setHighestCount. This is assumed to be set via ajax callbacks.
   * @returns {number}
   */
  getHighestCount: function() {
    return this._highestCount;
  },

  setLowestCount: function(count) {
    if (!this._lowestCount || count < this._lowestCount) {
      this._lowestCount = count;
    }
  },

  getLowestCount: function() {
    return this._lowestCount;
  },

  setCountRange: function(count) {
    this.setHighestCount(count);
    this.setLowestCount(count);
  },

  featureAt: function(tileID, tilePixelPoint) {
    if (!this._canvasIDToFeatures[tileID]) return null; // break out

    var zoom = tileID.split(":")[0];
    var x = tilePixelPoint.x;
    var y = tilePixelPoint.y;

    var index = this._canvasIDToFeatures[tileID].index;

    var minDistance = Number.POSITIVE_INFINITY;
    var nearest = null;
    var j, paths, distance;

    var matches = index.search([x, y, x, y]);
    for (var i = 0; i < matches.length; i++) {
      var feature = this.features[matches[i].id];
      switch (feature.type) {

        case 1: //Point - currently rendered as circular paths.  Intersect with that.

          //Find the radius of the point.
          var radius = 3;
          if (typeof feature.style.radius === 'function') {
            radius = feature.style.radius(zoom); //Allows for scale dependent rednering
          }
          else{
            radius = feature.style.radius;
          }

          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            //Builds a circle of radius feature.style.radius (assuming circular point symbology).
            if(in_circle(paths[j][0].x, paths[j][0].y, radius, x, y)){
              nearest = feature;
              minDistance = 0;
            }
          }
          break;

        case 2: //LineString
          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            if (feature.style) {
              var distance = this._getDistanceFromLine(tilePixelPoint, paths[j]);
              var thickness = (feature.selected && feature.style.selected ? feature.style.selected.size : feature.style.size);
              if (distance < thickness / 2 + this.options.lineClickTolerance && distance < minDistance) {
                nearest = feature;
                minDistance = distance;
              }
            }
          }
          break;

        case 3: //Polygon
          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            if (this._isPointInPoly(tilePixelPoint, paths[j])) {
              nearest = feature;
              minDistance = 0; // point is inside the polygon, so distance is zero
            }
          }
          break;
      }
      if (minDistance == 0) break;
    }

    return nearest;
  },

  clearTile: function(id) {
    //id is the entire zoom:x:y.  we just want x:y.
    var ca = id.split(":");
    var canvasId = ca[1] + ":" + ca[2];
    if (typeof this._tiles[canvasId] === 'undefined') {
      console.error("typeof this._tiles[canvasId] === 'undefined'");
      return;
    }
    var canvas = this._tiles[canvasId];

    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  },

  clearTileFeatureHash: function(canvasID) {
    // Get rid of all saved features
    this._canvasIDToFeatures[canvasID].features = [];
    this._canvasIDToFeatures[canvasID].index = rbush(9);
  },

  clearLayerFeatureHash: function(){
    this.features = {};
  },

  redrawTile: function(canvasID) {
    //First, clear the canvas
    this.clearTile(canvasID);

    // If the features are not in the tile, then there is nothing to redraw.
    // This may happen if you call redraw before features have loaded and initially
    // drawn the tile.
    var featfeats = this._canvasIDToFeatures[canvasID];
    if (!featfeats) {
      return;
    }

    //Get the features for this tile, and redraw them.
    var features = featfeats.features;

    // we want to skip drawing the selected features and draw them last
    var selectedFeatures = [];

    // drawing all of the non-selected features
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      if (feature.selected) {
        selectedFeatures.push(feature);
      } else {
        feature.draw(canvasID);
      }
    }

    // drawing the selected features last
    for (var j = 0, len2 = selectedFeatures.length; j < len2; j++) {
      var selFeat = selectedFeatures[j];
      selFeat.draw(canvasID);
    }
  },

  linkedLayer: function() {
    if(this.mvtSource.layerLink) {
      var linkName = this.mvtSource.layerLink(this.name);
      return this.mvtSource.layers[linkName];
    }
    else{
      return null;
    }
  },

  featureWithLabelAdded: function(feature) {
    this.featuresWithLabels.push(feature);
  }

});

function bbox(vtf, tileSize, id, buffer) {
  var divisor = vtf.extent / tileSize;

  var minX = Number.POSITIVE_INFINITY;
  var maxX = Number.NEGATIVE_INFINITY;
  var minY = Number.POSITIVE_INFINITY;
  var maxY = Number.NEGATIVE_INFINITY;
  vtf.coordinates.forEach(function(coordinates) {
    coordinates.forEach(function(coordinate) {
      var x = coordinate.x / divisor;
      var y = coordinate.y / divisor;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (buffer > 0) {
    minX -= buffer;
    maxX += buffer;
    minY -= buffer;
    maxY += buffer;
  }
  var box = [minX, minY, maxX, maxY];
  box.id = id;
  return box;
}


function removeLabels(self) {
  var features = self.featuresWithLabels;
  for (var i = 0, len = features.length; i < len; i++) {
    var feat = features[i];
    feat.removeLabel();
  }
  self.featuresWithLabels = [];
}

function in_circle(center_x, center_y, radius, x, y) {
  var square_dist = Math.pow((center_x - x), 2) + Math.pow((center_y - y), 2);
  return square_dist <= Math.pow(radius, 2);
}
/**
 * See https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()), //< defensive code
    interval = setInterval(function () {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('timeout'); //< Do what it's supposed to do once the condition is fulfilled
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('success'); //< Do what it's supposed to do once the condition is fulfilled
        }
      }
    }, 50); //< repeat check every 50ms
};

},{"./MVTFeature":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTFeature.js","./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","rbush":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/rbush/rbush.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTSource.js":[function(require,module,exports){
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var Point = require('point-geometry');
var Util = require('./MVTUtil');
var MVTLayer = require('./MVTLayer');


module.exports = L.TileLayer.MVTSource = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    url: "", //URL TO Vector Tile Source,
    getIDForLayerFeature: function() {},
    tileSize: 256,
    visibleLayers: null,
    buffer: 5,
    xhrHeaders: {}
  },
  layers: {}, //Keep a list of the layers contained in the PBFs
  processedTiles: {}, //Keep a list of tiles that have been processed already
  _eventHandlers: {},
  _triggerOnTilesLoadedEvent: true, //whether or not to fire the onTilesLoaded event when all of the tiles finish loading.
  _url: "", //internal URL property

  style: function(feature) {
    var style = {};

    var type = feature.type;
    switch (type) {
      case 1: //'Point'
        style.color = 'rgba(49,79,79,1)';
        style.radius = 5;
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          radius: 6
        };
        break;
      case 2: //'LineString'
        style.color = 'rgba(161,217,155,0.8)';
        style.size = 3;
        style.selected = {
          color: 'rgba(255,25,0,0.5)',
          size: 4
        };
        break;
      case 3: //'Polygon'
        style.color = 'rgba(49,79,79,1)';
        style.outline = {
          color: 'rgba(161,217,155,0.8)',
          size: 1
        };
        style.selected = {
          color: 'rgba(255,140,0,0.3)',
          outline: {
            color: 'rgba(255,140,0,1)',
            size: 2
          }
        };
        break;
    }
    return style;
  },


  initialize: function(options) {
    L.Util.setOptions(this, options);

    //a list of the layers contained in the PBFs
    this.layers = {};

    // tiles currently in the viewport
    this.activeTiles = {};

    this._url = this.options.url;

    /**
     * For some reason, Leaflet has some code that resets the
     * z index in the options object. I'm having trouble tracking
     * down exactly what does this and why, so for now, we should
     * just copy the value to this.zIndex so we can have the right
     * number when we make the subsequent MVTLayers.
     */
    this.zIndex = options.zIndex;

    if (typeof options.style === 'function' || typeof options.style === 'object') {
      this.style = options.style;
    }

    if (typeof options.ajaxSource === 'function') {
      this.ajaxSource = options.ajaxSource;
    }

    this.layerLink = options.layerLink;

    this._eventHandlers = {};

    this._tilesToProcess = 0; //store the max number of tiles to be loaded.  Later, we can use this count to count down PBF loading.
  },

  redraw: function(triggerOnTilesLoadedEvent){
    //Only set to false if it actually is passed in as 'false'
    if (triggerOnTilesLoadedEvent === false) {
      this._triggerOnTilesLoadedEvent = false;
    }

    L.TileLayer.Canvas.prototype.redraw.call(this);
  },

  onAdd: function(map) {
    this.map = map;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);

    map.on('click', this._onClick, this);

    if (this.options.onHover){
        map.on('mousemove', this._onHover, this);
    }

    this.addChildLayers(map);

    if (typeof DynamicLabel === 'function' ) {
      this.dynamicLabel = new DynamicLabel(map, this, {});
    }
  },

  onRemove: function(map) {
    this.fire('remove');
    this.removeChildLayers(map);
    map.off('click', this._onClick, this);
    L.TileLayer.Canvas.prototype.onRemove.call(this, map);
    this.map = null;
  },

  drawTile: function(canvas, tilePoint, zoom) {
    var ctx = {
      id: [zoom, tilePoint.x, tilePoint.y].join(":"),
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    //Capture the max number of the tiles to load here. this._tilesToProcess is an internal number we use to know when we've finished requesting PBFs.
    if(this._tilesToProcess < this._tilesToLoad) this._tilesToProcess = this._tilesToLoad;

    var id = ctx.id = Util.getContextID(ctx);
    this.activeTiles[id] = ctx;

    if(!this.processedTiles[ctx.zoom]) this.processedTiles[ctx.zoom] = {};

    if (this.options.debug) {
      this._drawDebugInfo(ctx);
    }
    this._draw(ctx);
  },

  setOpacity:function(opacity) {
    this._setVisibleLayersStyle('opacity',opacity);
  },

  setZIndex:function(zIndex) {
    this._setVisibleLayersStyle('zIndex',zIndex);
  },

  _setVisibleLayersStyle:function(style, value) {
    for(var key in this.layers) {
      this.layers[key]._tileContainer.style[style] = value;
    }
  },

  _drawDebugInfo: function(ctx) {
    var max = this.options.tileSize;
    var g = ctx.canvas.getContext('2d');
    g.strokeStyle = '#000000';
    g.fillStyle = '#FFFF00';
    g.strokeRect(0, 0, max, max);
    g.font = "12px Arial";
    g.fillRect(0, 0, 5, 5);
    g.fillRect(0, max - 5, 5, 5);
    g.fillRect(max - 5, 0, 5, 5);
    g.fillRect(max - 5, max - 5, 5, 5);
    g.fillRect(max / 2 - 5, max / 2 - 5, 10, 10);
    g.strokeText(ctx.zoom + ' ' + ctx.tile.x + ' ' + ctx.tile.y, max / 2 - 30, max / 2 - 10);
  },

  _draw: function(ctx) {
    var self = this;

//    //This works to skip fetching and processing tiles if they've already been processed.
//    var vectorTile = this.processedTiles[ctx.zoom][ctx.id];
//    //if we've already parsed it, don't get it again.
//    if(vectorTile){
//      console.log("Skipping fetching " + ctx.id);
//      self.checkVectorTileLayers(parseVT(vectorTile), ctx, true);
//      self.reduceTilesToProcessCount();
//      return;
//    }

    if (!this._url) return;
    var src = this.getTileUrl({ x: ctx.tile.x, y: ctx.tile.y, z: ctx.zoom });

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status == "200") {

        if(!xhr.response) return;

        var arrayBuffer = new Uint8Array(xhr.response);
        var buf = new Protobuf(arrayBuffer);
        var vt = new VectorTile(buf);
        // Check the attachment status of the layer.
        if (!self.map) {
          console.log("Fetched tile for removed map.");
          return;
        }
        // Check the current map layer zoom.  If fast zooming is occurring, then short circuit tiles that are for a different zoom level than we're currently on.
        if (self.map.getZoom() != ctx.zoom) {
          console.log("Fetched tile for zoom level " + ctx.zoom + ". Map is at zoom level " + self.map.getZoom());
          return;
        }
        self.checkVectorTileLayers(parseVT(vt), ctx);
      }

      //either way, reduce the count of tilesToProcess tiles here
      self.reduceTilesToProcessCount();
    };

    xhr.onerror = function() {
      console.log("xhr error: " + xhr.status)
    };

    xhr.open('GET', src, true); //async is true
    var headers = self.options.xhrHeaders;
    for (var header in headers) {
      xhr.setRequestHeader(header, headers[header]);
    }
    xhr.responseType = 'arraybuffer';
    xhr.send();
  },

  reduceTilesToProcessCount: function(){
    this._tilesToProcess--;
    if(!this._tilesToProcess){
      //Trigger event letting us know that all PBFs have been loaded and processed (or 404'd).
      if(this._eventHandlers["PBFLoad"]) this._eventHandlers["PBFLoad"]();
      this._pbfLoaded();
    }
  },

  checkVectorTileLayers: function(vt, ctx, parsed) {
    var self = this;

    //Check if there are specified visible layers
    var visibleLayers = self.options.visibleLayers;
    if (!visibleLayers) {
      visibleLayers = Object.keys(vt.layers);
    }

    var layerMapping = visibleLayers;
    if (Array.isArray(visibleLayers)) {
      layerMapping = {};
      for (var i=0; i < visibleLayers.length; i++) {
        layerMapping[visibleLayers[i]] = visibleLayers[i];
      }
    }

    for (var key in layerMapping) {
      var lyr = vt.layers[layerMapping[key]];
      if (lyr) {
        self.prepareMVTLayers(lyr, key, ctx, parsed);
      }
    }
  },

  prepareMVTLayers: function(lyr ,key, ctx, parsed) {
    var self = this;

    if (!self.layers[key]) {
      //Create MVTLayer or MVTPointLayer for user
      self.layers[key] = self.createMVTLayer(key, lyr.parsedFeatures[0].type || null);
    }

    if (parsed) {
      //We've already parsed it.  Go get canvas and draw.
      self.layers[key].getCanvas(ctx, lyr);
    } else {
      self.layers[key].parseVectorTileLayer(lyr, ctx);
    }

  },

  createMVTLayer: function(key, type) {
    var self = this;

    var getIDForLayerFeature;
    if (typeof self.options.getIDForLayerFeature === 'function') {
      getIDForLayerFeature = self.options.getIDForLayerFeature;
    } else {
      getIDForLayerFeature = Util.getIDForLayerFeature;
    }

    var style = self.style;
    if (typeof style === 'object') {
      style = style[key];
    }

    var options = {
      getIDForLayerFeature: getIDForLayerFeature,
      filter: self.options.filter,
      layerOrdering: self.options.layerOrdering,
      style: style,
      name: key,
      asynch: true,
      buffer: self.options.buffer
    };

    if (self.options.zIndex) {
      options.zIndex = self.zIndex;
    }

    //Take the layer and create a new MVTLayer or MVTPointLayer if one doesn't exist.
    var layer = new MVTLayer(self, options).addTo(self.map);

    return layer;
  },

  getLayers: function() {
    return this.layers;
  },

  hideLayer: function(id) {
    if (this.layers[id]) {
      this._map.removeLayer(this.layers[id]);
      var visibleLayers = this.options.visibleLayers;
      if (visibleLayers) {
        if (Array.isArray(visibleLayers) && visibleLayers.indexOf(id) > -1) {
          visibleLayers.splice(visibleLayers.indexOf(id), 1);
        } else {
          delete visibleLayers[id];
        }
      }
    }
  },

  showLayer: function(id) {
    if (this.layers[id]) {
      this._map.addLayer(this.layers[id]);
      var visibleLayers = this.options.visibleLayers;
      if (visibleLayers) {
        if (Array.isArray(visibleLayers)) {
          visibleLayers.push(id);
        } else {
          visibleLayers[id] = id;
        }
      }
    }
    //Make sure manager layer is always in front
    this.bringToFront();
  },

  removeChildLayers: function(map){
    //Remove child layers of this group layer
    for (var key in this.layers) {
      var layer = this.layers[key];
      map.removeLayer(layer);
    }
  },

  addChildLayers: function(map) {
    var visibleLayers = this.visibleLayers;
    if (visibleLayers) {
      //only let thru the layers listed in the visibleLayers array or object
      if (!Array.isArray(visibleLayers)) {
        visibleLayers = Object.keys(visibleLayers);
      }
      for(var i=0; i < visibleLayers.length; i++){
        var layerName = visibleLayers[i];
        var layer = this.layers[layerName];
        if(layer){
          //Proceed with parsing
          map.addLayer(layer);
        }
      }
    }else{
      //Add all layers
      for (var key in this.layers) {
        var layer = this.layers[key];
        // layer is set to visible and is not already on map
        if (!layer._map) {
          map.addLayer(layer);
        }
      }
    }
  },

  bind: function(eventType, callback) {
    this._eventHandlers[eventType] = callback;
  },

  featureAtLatLng: function(latlng) {
    return this.featureAtContainerPoint(this.map.latLngToContainerPoint(latlng));
  },

  featureAtContainerPoint: function(containerPoint) {
    return this._featureAt(containerPoint, this.layers);
  },

  _featureAt: function(containerPoint, layers) {
    var tilePoint = this._getTilePoint(containerPoint);

    // TODO: Z-ordering?  Clickable?
    for (var key in layers) {
      var layer = layers[key];
      var feature = layer.featureAt(tilePoint.tileID, tilePoint);
      if (feature) {
        return feature;
      }
    }
    return null;
  },

  _onHover: function(evt) {
    var self = this;
    var onHover = self.options.onHover;
    if (typeof onHover === 'function'){
        onHover(self, evt);
    }
  },

  _onClick: function(evt) {
    //Here, pass the event on to the child MVTLayer and have it do the hit test and handle the result.
    var self = this;
    var onClick = self.options.onClick;
    var clickableLayers = self.options.clickableLayers;
    var layers = self.layers;

    // We must have an array of clickable layers, otherwise, we just pass
    // the event to the public onClick callback in options.
    if (clickableLayers) {
      layers = {};
      for (var i = 0, len = clickableLayers.length; i < len; i++) {
        var key = clickableLayers[i];
        var layer = self.layers[key];
        if (layer) {
          layers[key] = layer;
        }
      }
    }

    var feature = this._featureAt(evt.containerPoint, layers);
    if (feature && feature.toggleEnabled) {
      feature.toggle();
    }

    evt.feature = feature;
    if (typeof onClick === 'function') {
      onClick(evt);
    }
  },

  setFilter: function(filterFunction, layerName) {
    //take in a new filter function.
    //Propagate to child layers.

    //Add filter to all child layers if no layer is specified.
    for (var key in this.layers) {
      var layer = this.layers[key];

      if (layerName){
        if(key.toLowerCase() == layerName.toLowerCase()){
          layer.options.filter = filterFunction; //Assign filter to child layer, only if name matches
          //After filter is set, the old feature hashes are invalid.  Clear them for next draw.
          layer.clearLayerFeatureHash();
          //layer.clearTileFeatureHash();
        }
      }
      else{
        layer.options.filter = filterFunction; //Assign filter to child layer
        //After filter is set, the old feature hashes are invalid.  Clear them for next draw.
        layer.clearLayerFeatureHash();
        //layer.clearTileFeatureHash();
      }
    }
  },

  /**
   * Take in a new style function and propogate to child layers.
   * If you do not set a layer name, it resets the style for all of the layers.
   * @param styleFunction
   * @param layerName
   */
  setStyle: function(styleFn, layerName) {
    for (var key in this.layers) {
      var layer = this.layers[key];
      if (layerName) {
        if(key.toLowerCase() == layerName.toLowerCase()) {
          layer.setStyle(styleFn);
        }
      } else {
        layer.setStyle(styleFn);
      }
    }
  },

  featureSelected: function(mvtFeature) {
    if (this.options.mutexToggle) {
      if (this._selectedFeature) {
        this._selectedFeature.deselect();
      }
      this._selectedFeature = mvtFeature;
    }
    if (this.options.onSelect) {
      this.options.onSelect(mvtFeature);
    }
  },

  featureDeselected: function(mvtFeature) {
    if (this.options.mutexToggle && this._selectedFeature) {
      this._selectedFeature = null;
    }
    if (this.options.onDeselect) {
      this.options.onDeselect(mvtFeature);
    }
  },

  _pbfLoaded: function() {
    //Fires when all tiles from this layer have been loaded and drawn (or 404'd).

    //Make sure manager layer is always in front
    this.bringToFront();

    //See if there is an event to execute
    var self = this;
    var onTilesLoaded = self.options.onTilesLoaded;

    if (onTilesLoaded && typeof onTilesLoaded === 'function' && this._triggerOnTilesLoadedEvent === true) {
      onTilesLoaded(this);
    }
    self._triggerOnTilesLoadedEvent = true; //reset - if redraw() is called with the optinal 'false' parameter to temporarily disable the onTilesLoaded event from firing.  This resets it back to true after a single time of firing as 'false'.
  },

  _getTilePoint: function(containerPoint) {
    var tileSize = this.options.tileSize;
    var globalPoint = this.map.containerPointToLayerPoint(containerPoint)
      .add(this.map.getPixelOrigin());

    var tileIndexPoint = globalPoint.divideBy(tileSize).floor();
    var tilePoint = globalPoint.subtract(tileIndexPoint.multiplyBy(tileSize));
    tilePoint.tileID = "" + this.map.getZoom() + ":" + tileIndexPoint.x + ":" + tileIndexPoint.y;
    return tilePoint;
  }

});


if (typeof(Number.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}

function parseVT(vt){
  for (var key in vt.layers) {
    var lyr = vt.layers[key];
    parseVTFeatures(lyr);
  }
  return vt;
}

function parseVTFeatures(vtl){
  vtl.parsedFeatures = [];
  var features = vtl._features;
  for (var i = 0, len = features.length; i < len; i++) {
    var vtf = vtl.feature(i);
    vtf.coordinates = vtf.loadGeometry();
    vtl.parsedFeatures.push(vtf);
  }
  return vtl;
}

},{"./MVTLayer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTLayer.js","./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","pbf":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/index.js","point-geometry":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js","vector-tile":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 8/15/14.
 */
var Util = module.exports = {};

Util.getContextID = function(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
};

/**
 * Default function that gets the id for a layer feature.
 * Sometimes this needs to be done in a different way and
 * can be specified by the user in the options for L.TileLayer.MVTSource.
 *
 * @param feature
 * @returns {ctx.id|*|id|string|jsts.index.chain.MonotoneChain.id|number}
 */
Util.getIDForLayerFeature = function(feature) {
  return feature.properties.id;
};

Util.getJSON = function(url, callback) {
  var xmlhttp = typeof XMLHttpRequest !== 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
  xmlhttp.onreadystatechange = function() {
    var status = xmlhttp.status;
    if (xmlhttp.readyState === 4 && status >= 200 && status < 300) {
      var json = JSON.parse(xmlhttp.responseText);
      callback(null, json);
    } else {
      callback( { error: true, status: status } );
    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.send();
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/31/14.
 */
var Util = require('../MVTUtil');
module.exports = StaticLabel;

function StaticLabel(mvtFeature, ctx, latLng, style) {
  var self = this;
  this.mvtFeature = mvtFeature;
  this.map = mvtFeature.map;
  this.zoom = ctx.zoom;
  this.latLng = latLng;
  this.selected = false;

  if (mvtFeature.linkedFeature) {
    var linkedFeature = mvtFeature.linkedFeature();
    if (linkedFeature && linkedFeature.selected) {
      self.selected = true;
    }
  }

  init(self, mvtFeature, ctx, latLng, style)
}

function init(self, mvtFeature, ctx, latLng, style) {
  var ajaxData = mvtFeature.ajaxData;
  var sty = self.style = style.staticLabel(mvtFeature, ajaxData);
  var icon = self.icon = L.divIcon({
    className: sty.cssClass || 'label-icon-text',
    html: sty.html,
    iconSize: sty.iconSize || [50,50]
  });

  self.marker = L.marker(latLng, {icon: icon}).addTo(self.map);

  if (self.selected) {
    self.marker._icon.classList.add(self.style.cssSelectedClass || 'label-icon-text-selected');
  }

  self.marker.on('click', self.toggle, self);

  self.map.on('zoomend', this._onZoomEnd, this);
}


StaticLabel.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

StaticLabel.prototype.select = function() {
  this.selected = true;
  this.marker._icon.classList.add(this.style.cssSelectedClass || 'label-icon-text-selected');
  var linkedFeature = this.mvtFeature.linkedFeature();
  if (!linkedFeature.selected) linkedFeature.select();
};

StaticLabel.prototype.deselect = function() {
  this.selected = false;
  this.marker._icon.classList.remove(this.style.cssSelectedClass || 'label-icon-text-selected');
  var linkedFeature = this.mvtFeature.linkedFeature();
  if (linkedFeature.selected) linkedFeature.deselect();
};

StaticLabel.prototype.remove = function() {
  if (!this.map || !this.marker) return;
  this.map.off('zoomend', this._onZoomEnd, this);
  this.map.removeLayer(this.marker);
};

StaticLabel.prototype._onZoomEnd = function() {
  var newZoom = e.target.getZoom();
  if (this.zoom !== newZoom) {
    this.remove();
  }
}

},{"../MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/control/Control.MVTLayers.js":[function(require,module,exports){
/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

module.exports = L.Control.MVTLayers = L.Control.Layers.extend({

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

        // Map from vector layer name to presented name in toggle
        this._layerNames = this.options.layerNames || {};
		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this.addBaseLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this.addMVTLayer(overlays[i], i);
		}
	},

	addMVTLayer: function (layer, name) {

        var onTileLoad = function(mvtSrc){
            for (var key in mvtSrc.getLayers()){
                var name = this._layerNames[key] || key;
                this.addOverlay(mvtSrc.layers[key], name);
            }
            this._update();
        }
        layer.options.onTilesLoaded = onTileLoad.bind(this);
		return this._update();
	},

	_onInputClick: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input, layer, hasLayer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._layers[input.layerId].layer;
			hasLayer = this._map.hasLayer(layer);

			if (input.checked && !hasLayer) {
				addedLayers.push(layer);

			} else if (!input.checked && hasLayer) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
            var rl = removedLayers[i];

            // If we're removing a vector layer
            if (rl.mvtSource){
                rl.mvtSource.hideLayer(rl.name);
            } else {
                this._map.removeLayer(removedLayers[i]);
            }
		}
		for (i = 0; i < addedLayers.length; i++) {
            var al = addedLayers[i];

            // If we're adding a vector layer
            if (al.mvtSource){
                al.mvtSource.showLayer(al.name);
                al.mvtSource.redraw();
            } else {
                this._map.addLayer(addedLayers[i]);
            }
		}

		this._handlingClick = false;
		this._refocusOnMap();
	},
});

L.control.mvtLayers = function (baseLayers, overlays, options) {
	return new L.Control.MVTLayers(baseLayers, overlays, options);
};

L.DomUtil.empty = function (el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};



},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/index.js":[function(require,module,exports){
/**
 * Copyright (c) 2014, Spatial Development International
 * All rights reserved.
 *
 * Source code can be found at:
 * https://github.com/SpatialServer/Leaflet.MapboxVectorTile
 *
 * @license ISC
 */

module.exports = {};
module.exports.MVTSource = require('./MVTSource');
module.exports.Control = {
    MVTLayers: require("./control/Control.MVTLayers")
};

},{"./MVTSource":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTSource.js","./control/Control.MVTLayers":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/control/Control.MVTLayers.js"}]},{},["/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pcy1hcnJheS9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BiZi9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BiZi9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BvaW50LWdlb21ldHJ5L2luZGV4LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvcmJ1c2gvcmJ1c2guanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy92ZWN0b3ItdGlsZS9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3ZlY3Rvci10aWxlL2xpYi92ZWN0b3J0aWxlLmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVmZWF0dXJlLmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVsYXllci5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVEZlYXR1cmUuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9NVlRMYXllci5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVFNvdXJjZS5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVFV0aWwuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9TdGF0aWNMYWJlbC9TdGF0aWNMYWJlbC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL2NvbnRyb2wvQ29udHJvbC5NVlRMYXllcnMuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1aENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDem1CQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9nQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbmtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXMtYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIga01heExlbmd0aCA9IDB4M2ZmZmZmZmZcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAtIEltcGxlbWVudGF0aW9uIG11c3Qgc3VwcG9ydCBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcy5cbiAqICAgRmlyZWZveCA0LTI5IGxhY2tlZCBzdXBwb3J0LCBmaXhlZCBpbiBGaXJlZm94IDMwKy5cbiAqICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cbiAqXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleSB3aWxsXG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCB3aWxsIHdvcmsgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IChmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBuZXcgVWludDhBcnJheSgxKS5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBzdWJqZWN0ID4gMCA/IHN1YmplY3QgPj4+IDAgOiAwXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JylcbiAgICAgIHN1YmplY3QgPSBiYXNlNjRjbGVhbihzdWJqZWN0KVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnICYmIHN1YmplY3QgIT09IG51bGwpIHsgLy8gYXNzdW1lIG9iamVjdCBpcyBhcnJheS1saWtlXG4gICAgaWYgKHN1YmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShzdWJqZWN0LmRhdGEpKVxuICAgICAgc3ViamVjdCA9IHN1YmplY3QuZGF0YVxuICAgIGxlbmd0aCA9ICtzdWJqZWN0Lmxlbmd0aCA+IDAgPyBNYXRoLmZsb29yKCtzdWJqZWN0Lmxlbmd0aCkgOiAwXG4gIH0gZWxzZVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcblxuICBpZiAodGhpcy5sZW5ndGggPiBrTWF4TGVuZ3RoKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSAoKHN1YmplY3RbaV0gJSAyNTYpICsgMjU2KSAlIDI1NlxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW4gJiYgYVtpXSA9PT0gYltpXTsgaSsrKSB7fVxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0WywgbGVuZ3RoXSknKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHRvdGFsTGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyICsgJydcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggPj4+IDFcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbi8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG5CdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcblxuLy8gdG9TdHJpbmcoZW5jb2RpbmcsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKVxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAoYikge1xuICBpZighQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heClcbiAgICAgIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKGJ5dGUpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiB1dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoLCAyKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHV0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIGFzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW47XG4gICAgaWYgKHN0YXJ0IDwgMClcbiAgICAgIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKVxuICAgICAgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KVxuICAgIGVuZCA9IHN0YXJ0XG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSlcbiAgICByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgaWYgKHRhcmdldF9zdGFydCA8IDAgfHwgdGFyZ2V0X3N0YXJ0ID49IHRhcmdldC5sZW5ndGgpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gc291cmNlLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHNvdXJjZS5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5jb25zdHJ1Y3RvciA9IEJ1ZmZlclxuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgZ2V0L3NldCBtZXRob2RzIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX2dldCA9IGFyci5nZXRcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuZXF1YWxzID0gQlAuZXF1YWxzXG4gIGFyci5jb21wYXJlID0gQlAuY29tcGFyZVxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtel0vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpIHtcbiAgICAgIGJ5dGVBcnJheS5wdXNoKGIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCwgdW5pdFNpemUpIHtcbiAgaWYgKHVuaXRTaXplKSBsZW5ndGggLT0gbGVuZ3RoICUgdW5pdFNpemU7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiXG4vKipcbiAqIGlzQXJyYXlcbiAqL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogdG9TdHJpbmdcbiAqL1xuXG52YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBXaGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gYHZhbGBcbiAqIGlzIGFuIGFycmF5LlxuICpcbiAqIGV4YW1wbGU6XG4gKlxuICogICAgICAgIGlzQXJyYXkoW10pO1xuICogICAgICAgIC8vID4gdHJ1ZVxuICogICAgICAgIGlzQXJyYXkoYXJndW1lbnRzKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKiAgICAgICAgaXNBcnJheSgnJyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICpcbiAqIEBwYXJhbSB7bWl4ZWR9IHZhbFxuICogQHJldHVybiB7Ym9vbH1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXkgfHwgZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gISEgdmFsICYmICdbb2JqZWN0IEFycmF5XScgPT0gc3RyLmNhbGwodmFsKTtcbn07XG4iLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3RvYnVmO1xuZnVuY3Rpb24gUHJvdG9idWYoYnVmKSB7XG4gICAgdGhpcy5idWYgPSBidWY7XG4gICAgdGhpcy5wb3MgPSAwO1xufVxuXG5Qcm90b2J1Zi5wcm90b3R5cGUgPSB7XG4gICAgZ2V0IGxlbmd0aCgpIHsgcmV0dXJuIHRoaXMuYnVmLmxlbmd0aDsgfVxufTtcblxuUHJvdG9idWYuVmFyaW50ID0gMDtcblByb3RvYnVmLkludDY0ID0gMTtcblByb3RvYnVmLk1lc3NhZ2UgPSAyO1xuUHJvdG9idWYuU3RyaW5nID0gMjtcblByb3RvYnVmLlBhY2tlZCA9IDI7XG5Qcm90b2J1Zi5JbnQzMiA9IDU7XG5cblByb3RvYnVmLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5idWYgPSBudWxsO1xufTtcblxuLy8gPT09IFJFQURJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRVSW50MzIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gdGhpcy5idWYucmVhZFVJbnQzMkxFKHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA0O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFVJbnQ2NCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWwgPSB0aGlzLmJ1Zi5yZWFkVUludDY0TEUodGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG4gICAgcmV0dXJuIHZhbDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkRG91YmxlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZhbCA9IGllZWU3NTQucmVhZCh0aGlzLmJ1ZiwgdGhpcy5wb3MsIHRydWUsIDUyLCA4KTtcbiAgICB0aGlzLnBvcyArPSA4O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBwb3MgPSB0aGlzLnBvcztcbiAgICBpZiAodGhpcy5idWZbcG9zXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zKys7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1Zltwb3NdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgMV0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSAyO1xuICAgICAgICByZXR1cm4gKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSA8PCA3KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDJdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gMztcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdKSA8PCAxNDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDNdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gNDtcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgNF0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSA1O1xuICAgICAgICByZXR1cm4gKCh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxKSArICh0aGlzLmJ1Zltwb3MgKyA0XSAqIDI2ODQzNTQ1Nik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5za2lwKFByb3RvYnVmLlZhcmludCk7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoXCJUT0RPOiBIYW5kbGUgNisgYnl0ZSB2YXJpbnRzXCIpO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkU1ZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBudW0gPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICBpZiAobnVtID4gMjE0NzQ4MzY0NykgdGhyb3cgbmV3IEVycm9yKCdUT0RPOiBIYW5kbGUgbnVtYmVycyA+PSAyXjMwJyk7XG4gICAgLy8gemlnemFnIGVuY29kaW5nXG4gICAgcmV0dXJuICgobnVtID4+IDEpIF4gLShudW0gJiAxKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBjaHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuICAgIHZhciBiID0gdGhpcy5idWY7XG4gICAgdmFyIHAgPSB0aGlzLnBvcztcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgd2hpbGUgKHAgPCBlbmQpIHtcbiAgICAgICAgaWYgKGJbcF0gPD0gMHg3Rikgc3RyICs9IGNocihiW3ArK10pO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4QkYpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVVEYtOCBjb2RlcG9pbnQ6ICcgKyBiW3BdKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweERGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEVGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCAxMiB8IChiW3ArK10gJiAweDNGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEY3KSBwICs9IDQ7IC8vIFdlIGNhbid0IGhhbmRsZSB0aGVzZSBjb2RlcG9pbnRzIGluIEpTLCBzbyBza2lwLlxuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RkIpIHAgKz0gNTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEZEKSBwICs9IDY7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVURi04IGNvZGVwb2ludDogJyArIGJbcF0pO1xuICAgIH1cbiAgICB0aGlzLnBvcyArPSBieXRlcztcbiAgICByZXR1cm4gc3RyO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5idWYuc3ViYXJyYXkodGhpcy5wb3MsIHRoaXMucG9zICsgYnl0ZXMpO1xuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xuICAgIHJldHVybiBidWZmZXI7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFBhY2tlZCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgYXJyYXkgPSBbXTtcbiAgICB3aGlsZSAodGhpcy5wb3MgPCBlbmQpIHtcbiAgICAgICAgYXJyYXkucHVzaCh0aGlzWydyZWFkJyArIHR5cGVdKCkpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciB0eXBlID0gdmFsICYgMHg3O1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAvKiB2YXJpbnQgKi8gY2FzZSBQcm90b2J1Zi5WYXJpbnQ6IHdoaWxlICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA+IDB4N2YpOyBicmVhaztcbiAgICAgICAgLyogNjQgYml0ICovIGNhc2UgUHJvdG9idWYuSW50NjQ6IHRoaXMucG9zICs9IDg7IGJyZWFrO1xuICAgICAgICAvKiBsZW5ndGggKi8gY2FzZSBQcm90b2J1Zi5NZXNzYWdlOiB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTsgdGhpcy5wb3MgKz0gYnl0ZXM7IGJyZWFrO1xuICAgICAgICAvKiAzMiBiaXQgKi8gY2FzZSBQcm90b2J1Zi5JbnQzMjogdGhpcy5wb3MgKz0gNDsgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcignVW5pbXBsZW1lbnRlZCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxufTtcblxuLy8gPT09IFdSSVRJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnID0gZnVuY3Rpb24odGFnLCB0eXBlKSB7XG4gICAgdGhpcy53cml0ZVZhcmludCgodGFnIDw8IDMpIHwgdHlwZSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhbGxvYyA9IGZ1bmN0aW9uKG1pbikge1xuICAgIHZhciBsZW5ndGggPSB0aGlzLmJ1Zi5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aCA8IHRoaXMucG9zICsgbWluKSBsZW5ndGggKj0gMjtcbiAgICBpZiAobGVuZ3RoICE9IHRoaXMuYnVmLmxlbmd0aCkge1xuICAgICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgICB0aGlzLmJ1Zi5jb3B5KGJ1Zik7XG4gICAgICAgIHRoaXMuYnVmID0gYnVmO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5maW5pc2ggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5idWYuc2xpY2UoMCwgdGhpcy5wb3MpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlUGFja2VkID0gZnVuY3Rpb24odHlwZSwgdGFnLCBpdGVtcykge1xuICAgIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG5cbiAgICB2YXIgbWVzc2FnZSA9IG5ldyBQcm90b2J1ZigpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbWVzc2FnZVsnd3JpdGUnICsgdHlwZV0oaXRlbXNbaV0pO1xuICAgIH1cbiAgICB2YXIgZGF0YSA9IG1lc3NhZ2UuZmluaXNoKCk7XG5cbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuUGFja2VkKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGRhdGEpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVUludDMyID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgIHRoaXMuYnVmLndyaXRlVUludDMyTEUodmFsLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gNDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFVJbnQzMiA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlVUludDMyKHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB2YWwgPSBOdW1iZXIodmFsKTtcbiAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICB2YWwgPSAwO1xuICAgIH1cblxuICAgIGlmICh2YWwgPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gdmFsO1xuICAgIH0gZWxzZSBpZiAodmFsIDw9IDB4M2ZmZikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAwKSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4MDAgfCAoKHZhbCA+Pj4gNykgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweDFmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDMpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHgwMCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweGZmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDAwIHwgKCh2YWwgPj4+IDIxKSAmIDB4N2YpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh2YWwgPiAwKSB7XG4gICAgICAgICAgICB2YXIgYiA9IHZhbCAmIDB4N2Y7XG4gICAgICAgICAgICB2YWwgPSBNYXRoLmZsb29yKHZhbCAvIDEyOCk7XG4gICAgICAgICAgICBpZiAodmFsID4gMCkgYiB8PSAweDgwXG4gICAgICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IGI7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRWYXJpbnQgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5WYXJpbnQpO1xuICAgIHRoaXMud3JpdGVWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVNWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICBpZiAodmFsID49IDApIHtcbiAgICAgICAgdGhpcy53cml0ZVZhcmludCh2YWwgKiAyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLndyaXRlVmFyaW50KHZhbCAqIC0yIC0gMSk7XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkU1ZhcmludCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlZhcmludCk7XG4gICAgdGhpcy53cml0ZVNWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZUJvb2xlYW4gPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLndyaXRlVmFyaW50KEJvb2xlYW4odmFsKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCb29sZWFuID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnZ2VkVmFyaW50KHRhZywgQm9vbGVhbih2YWwpKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVN0cmluZyA9IGZ1bmN0aW9uKHN0cikge1xuICAgIHN0ciA9IFN0cmluZyhzdHIpO1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN0cik7XG4gICAgdGhpcy53cml0ZVZhcmludChieXRlcyk7XG4gICAgdGhpcy5yZWFsbG9jKGJ5dGVzKTtcbiAgICB0aGlzLmJ1Zi53cml0ZShzdHIsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSBieXRlcztcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFN0cmluZyA9IGZ1bmN0aW9uKHRhZywgc3RyKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlN0cmluZyk7XG4gICAgdGhpcy53cml0ZVN0cmluZyhzdHIpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlRmxvYXQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLnJlYWxsb2MoNCk7XG4gICAgdGhpcy5idWYud3JpdGVGbG9hdExFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDQ7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRGbG9hdCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlRmxvYXQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZURvdWJsZSA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMucmVhbGxvYyg4KTtcbiAgICB0aGlzLmJ1Zi53cml0ZURvdWJsZUxFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWREb3VibGUgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5JbnQ2NCk7XG4gICAgdGhpcy53cml0ZURvdWJsZSh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgdmFyIGJ5dGVzID0gYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLndyaXRlVmFyaW50KGJ5dGVzKTtcbiAgICB0aGlzLnJlYWxsb2MoYnl0ZXMpO1xuICAgIGJ1ZmZlci5jb3B5KHRoaXMuYnVmLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCdWZmZXIgPSBmdW5jdGlvbih0YWcsIGJ1ZmZlcikge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5TdHJpbmcpO1xuICAgIHRoaXMud3JpdGVCdWZmZXIoYnVmZmVyKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZU1lc3NhZ2UgPSBmdW5jdGlvbih0YWcsIHByb3RvYnVmKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHByb3RvYnVmLmZpbmlzaCgpO1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5NZXNzYWdlKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGJ1ZmZlcik7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIpXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5d1ltWXZhVzVrWlhndWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJwWldWbE56VTBJRDBnY21WeGRXbHlaU2duYVdWbFpUYzFOQ2NwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGQnliM1J2WW5WbU8xeHVablZ1WTNScGIyNGdVSEp2ZEc5aWRXWW9ZblZtS1NCN1hHNGdJQ0FnZEdocGN5NWlkV1lnUFNCaWRXWTdYRzRnSUNBZ2RHaHBjeTV3YjNNZ1BTQXdPMXh1ZlZ4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVWdQU0I3WEc0Z0lDQWdaMlYwSUd4bGJtZDBhQ2dwSUhzZ2NtVjBkWEp1SUhSb2FYTXVZblZtTG14bGJtZDBhRHNnZlZ4dWZUdGNibHh1VUhKdmRHOWlkV1l1Vm1GeWFXNTBJRDBnTUR0Y2JsQnliM1J2WW5WbUxrbHVkRFkwSUQwZ01UdGNibEJ5YjNSdlluVm1MazFsYzNOaFoyVWdQU0F5TzF4dVVISnZkRzlpZFdZdVUzUnlhVzVuSUQwZ01qdGNibEJ5YjNSdlluVm1MbEJoWTJ0bFpDQTlJREk3WEc1UWNtOTBiMkoxWmk1SmJuUXpNaUE5SURVN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzVrWlhOMGNtOTVJRDBnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnZEdocGN5NWlkV1lnUFNCdWRXeHNPMXh1ZlR0Y2JseHVMeThnUFQwOUlGSkZRVVJKVGtjZ1BUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMWNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5KbFlXUlZTVzUwTXpJZ1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQjJZWElnZG1Gc0lEMGdkR2hwY3k1aWRXWXVjbVZoWkZWSmJuUXpNa3hGS0hSb2FYTXVjRzl6S1R0Y2JpQWdJQ0IwYUdsekxuQnZjeUFyUFNBME8xeHVJQ0FnSUhKbGRIVnliaUIyWVd3N1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWNtVmhaRlZKYm5RMk5DQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFpoY2lCMllXd2dQU0IwYUdsekxtSjFaaTV5WldGa1ZVbHVkRFkwVEVVb2RHaHBjeTV3YjNNcE8xeHVJQ0FnSUhSb2FYTXVjRzl6SUNzOUlEZzdYRzRnSUNBZ2NtVjBkWEp1SUhaaGJEdGNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNXlaV0ZrUkc5MVlteGxJRDBnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnZG1GeUlIWmhiQ0E5SUdsbFpXVTNOVFF1Y21WaFpDaDBhR2x6TG1KMVppd2dkR2hwY3k1d2IzTXNJSFJ5ZFdVc0lEVXlMQ0E0S1R0Y2JpQWdJQ0IwYUdsekxuQnZjeUFyUFNBNE8xeHVJQ0FnSUhKbGRIVnliaUIyWVd3N1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWNtVmhaRlpoY21sdWRDQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJQzh2SUZSUFJFODZJR0p2ZFc1a2N5QmphR1ZqYTJsdVoxeHVJQ0FnSUhaaGNpQndiM01nUFNCMGFHbHpMbkJ2Y3p0Y2JpQWdJQ0JwWmlBb2RHaHBjeTVpZFdaYmNHOXpYU0E4UFNBd2VEZG1LU0I3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVjRzl6S3lzN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCMGFHbHpMbUoxWmx0d2IzTmRPMXh1SUNBZ0lIMGdaV3h6WlNCcFppQW9kR2hwY3k1aWRXWmJjRzl6SUNzZ01WMGdQRDBnTUhnM1ppa2dlMXh1SUNBZ0lDQWdJQ0IwYUdsekxuQnZjeUFyUFNBeU8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z0tIUm9hWE11WW5WbVczQnZjMTBnSmlBd2VEZG1LU0I4SUNoMGFHbHpMbUoxWmx0d2IzTWdLeUF4WFNBOFBDQTNLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLSFJvYVhNdVluVm1XM0J2Y3lBcklESmRJRHc5SURCNE4yWXBJSHRjYmlBZ0lDQWdJQ0FnZEdocGN5NXdiM01nS3owZ016dGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlDaDBhR2x6TG1KMVpsdHdiM05kSUNZZ01IZzNaaWtnZkNBb2RHaHBjeTVpZFdaYmNHOXpJQ3NnTVYwZ0ppQXdlRGRtS1NBOFBDQTNJSHdnS0hSb2FYTXVZblZtVzNCdmN5QXJJREpkS1NBOFBDQXhORHRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLSFJvYVhNdVluVm1XM0J2Y3lBcklETmRJRHc5SURCNE4yWXBJSHRjYmlBZ0lDQWdJQ0FnZEdocGN5NXdiM01nS3owZ05EdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlDaDBhR2x6TG1KMVpsdHdiM05kSUNZZ01IZzNaaWtnZkNBb2RHaHBjeTVpZFdaYmNHOXpJQ3NnTVYwZ0ppQXdlRGRtS1NBOFBDQTNJSHdnS0hSb2FYTXVZblZtVzNCdmN5QXJJREpkSUNZZ01IZzNaaWtnUER3Z01UUWdmQ0FvZEdocGN5NWlkV1piY0c5eklDc2dNMTBwSUR3OElESXhPMXh1SUNBZ0lIMGdaV3h6WlNCcFppQW9kR2hwY3k1aWRXWmJjRzl6SUNzZ05GMGdQRDBnTUhnM1ppa2dlMXh1SUNBZ0lDQWdJQ0IwYUdsekxuQnZjeUFyUFNBMU8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z0tDaDBhR2x6TG1KMVpsdHdiM05kSUNZZ01IZzNaaWtnZkNBb2RHaHBjeTVpZFdaYmNHOXpJQ3NnTVYwZ0ppQXdlRGRtS1NBOFBDQTNJSHdnS0hSb2FYTXVZblZtVzNCdmN5QXJJREpkSUNZZ01IZzNaaWtnUER3Z01UUWdmQ0FvZEdocGN5NWlkV1piY0c5eklDc2dNMTBwSUR3OElESXhLU0FySUNoMGFHbHpMbUoxWmx0d2IzTWdLeUEwWFNBcUlESTJPRFF6TlRRMU5pazdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV6YTJsd0tGQnliM1J2WW5WbUxsWmhjbWx1ZENrN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlBd08xeHVJQ0FnSUNBZ0lDQXZMeUIwYUhKdmR5QnVaWGNnUlhKeWIzSW9YQ0pVVDBSUE9pQklZVzVrYkdVZ05pc2dZbmwwWlNCMllYSnBiblJ6WENJcE8xeHVJQ0FnSUgxY2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1eVpXRmtVMVpoY21sdWRDQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFpoY2lCdWRXMGdQU0IwYUdsekxuSmxZV1JXWVhKcGJuUW9LVHRjYmlBZ0lDQnBaaUFvYm5WdElENGdNakUwTnpRNE16WTBOeWtnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RVVDBSUE9pQklZVzVrYkdVZ2JuVnRZbVZ5Y3lBK1BTQXlYak13SnlrN1hHNGdJQ0FnTHk4Z2VtbG5lbUZuSUdWdVkyOWthVzVuWEc0Z0lDQWdjbVYwZFhKdUlDZ29iblZ0SUQ0K0lERXBJRjRnTFNodWRXMGdKaUF4S1NrN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWNtVmhaRk4wY21sdVp5QTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFpoY2lCaWVYUmxjeUE5SUhSb2FYTXVjbVZoWkZaaGNtbHVkQ2dwTzF4dUlDQWdJQzh2SUZSUFJFODZJR0p2ZFc1a2N5QmphR1ZqYTJsdVoxeHVJQ0FnSUhaaGNpQmphSElnUFNCVGRISnBibWN1Wm5KdmJVTm9ZWEpEYjJSbE8xeHVJQ0FnSUhaaGNpQmlJRDBnZEdocGN5NWlkV1k3WEc0Z0lDQWdkbUZ5SUhBZ1BTQjBhR2x6TG5CdmN6dGNiaUFnSUNCMllYSWdaVzVrSUQwZ2RHaHBjeTV3YjNNZ0t5QmllWFJsY3p0Y2JpQWdJQ0IyWVhJZ2MzUnlJRDBnSnljN1hHNGdJQ0FnZDJocGJHVWdLSEFnUENCbGJtUXBJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHSmJjRjBnUEQwZ01IZzNSaWtnYzNSeUlDczlJR05vY2loaVczQXJLMTBwTzF4dUlDQWdJQ0FnSUNCbGJITmxJR2xtSUNoaVczQmRJRHc5SURCNFFrWXBJSFJvY205M0lHNWxkeUJGY25KdmNpZ25TVzUyWVd4cFpDQlZWRVl0T0NCamIyUmxjRzlwYm5RNklDY2dLeUJpVzNCZEtUdGNiaUFnSUNBZ0lDQWdaV3h6WlNCcFppQW9ZbHR3WFNBOFBTQXdlRVJHS1NCemRISWdLejBnWTJoeUtDaGlXM0FySzEwZ0ppQXdlREZHS1NBOFBDQTJJSHdnS0dKYmNDc3JYU0FtSURCNE0wWXBLVHRjYmlBZ0lDQWdJQ0FnWld4elpTQnBaaUFvWWx0d1hTQThQU0F3ZUVWR0tTQnpkSElnS3owZ1kyaHlLQ2hpVzNBcksxMGdKaUF3ZURGR0tTQThQQ0F4TWlCOElDaGlXM0FySzEwZ0ppQXdlRE5HS1NBOFBDQTJJSHdnS0dKYmNDc3JYU0FtSURCNE0wWXBLVHRjYmlBZ0lDQWdJQ0FnWld4elpTQnBaaUFvWWx0d1hTQThQU0F3ZUVZM0tTQndJQ3M5SURRN0lDOHZJRmRsSUdOaGJpZDBJR2hoYm1Sc1pTQjBhR1Z6WlNCamIyUmxjRzlwYm5SeklHbHVJRXBUTENCemJ5QnphMmx3TGx4dUlDQWdJQ0FnSUNCbGJITmxJR2xtSUNoaVczQmRJRHc5SURCNFJrSXBJSEFnS3owZ05UdGNiaUFnSUNBZ0lDQWdaV3h6WlNCcFppQW9ZbHR3WFNBOFBTQXdlRVpFS1NCd0lDczlJRFk3WEc0Z0lDQWdJQ0FnSUdWc2MyVWdkR2h5YjNjZ2JtVjNJRVZ5Y205eUtDZEpiblpoYkdsa0lGVlVSaTA0SUdOdlpHVndiMmx1ZERvZ0p5QXJJR0piY0YwcE8xeHVJQ0FnSUgxY2JpQWdJQ0IwYUdsekxuQnZjeUFyUFNCaWVYUmxjenRjYmlBZ0lDQnlaWFIxY200Z2MzUnlPMXh1ZlR0Y2JseHVVSEp2ZEc5aWRXWXVjSEp2ZEc5MGVYQmxMbkpsWVdSQ2RXWm1aWElnUFNCbWRXNWpkR2x2YmlncElIdGNiaUFnSUNCMllYSWdZbmwwWlhNZ1BTQjBhR2x6TG5KbFlXUldZWEpwYm5Rb0tUdGNiaUFnSUNCMllYSWdZblZtWm1WeUlEMGdkR2hwY3k1aWRXWXVjM1ZpWVhKeVlYa29kR2hwY3k1d2IzTXNJSFJvYVhNdWNHOXpJQ3NnWW5sMFpYTXBPMXh1SUNBZ0lIUm9hWE11Y0c5eklDczlJR0o1ZEdWek8xeHVJQ0FnSUhKbGRIVnliaUJpZFdabVpYSTdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjbVZoWkZCaFkydGxaQ0E5SUdaMWJtTjBhVzl1S0hSNWNHVXBJSHRjYmlBZ0lDQXZMeUJVVDBSUE9pQmliM1Z1WkhNZ1kyaGxZMnRwYm1kY2JpQWdJQ0IyWVhJZ1lubDBaWE1nUFNCMGFHbHpMbkpsWVdSV1lYSnBiblFvS1R0Y2JpQWdJQ0IyWVhJZ1pXNWtJRDBnZEdocGN5NXdiM01nS3lCaWVYUmxjenRjYmlBZ0lDQjJZWElnWVhKeVlYa2dQU0JiWFR0Y2JpQWdJQ0IzYUdsc1pTQW9kR2hwY3k1d2IzTWdQQ0JsYm1RcElIdGNiaUFnSUNBZ0lDQWdZWEp5WVhrdWNIVnphQ2gwYUdseld5ZHlaV0ZrSnlBcklIUjVjR1ZkS0NrcE8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZWEp5WVhrN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWMydHBjQ0E5SUdaMWJtTjBhVzl1S0haaGJDa2dlMXh1SUNBZ0lDOHZJRlJQUkU4NklHSnZkVzVrY3lCamFHVmphMmx1WjF4dUlDQWdJSFpoY2lCMGVYQmxJRDBnZG1Gc0lDWWdNSGczTzF4dUlDQWdJSE4zYVhSamFDQW9kSGx3WlNrZ2UxeHVJQ0FnSUNBZ0lDQXZLaUIyWVhKcGJuUWdLaThnWTJGelpTQlFjbTkwYjJKMVppNVdZWEpwYm5RNklIZG9hV3hsSUNoMGFHbHpMbUoxWmx0MGFHbHpMbkJ2Y3lzclhTQStJREI0TjJZcE95QmljbVZoYXp0Y2JpQWdJQ0FnSUNBZ0x5b2dOalFnWW1sMElDb3ZJR05oYzJVZ1VISnZkRzlpZFdZdVNXNTBOalE2SUhSb2FYTXVjRzl6SUNzOUlEZzdJR0p5WldGck8xeHVJQ0FnSUNBZ0lDQXZLaUJzWlc1bmRHZ2dLaThnWTJGelpTQlFjbTkwYjJKMVppNU5aWE56WVdkbE9pQjJZWElnWW5sMFpYTWdQU0IwYUdsekxuSmxZV1JXWVhKcGJuUW9LVHNnZEdocGN5NXdiM01nS3owZ1lubDBaWE03SUdKeVpXRnJPMXh1SUNBZ0lDQWdJQ0F2S2lBek1pQmlhWFFnS2k4Z1kyRnpaU0JRY205MGIySjFaaTVKYm5Rek1qb2dkR2hwY3k1d2IzTWdLejBnTkRzZ1luSmxZV3M3WEc0Z0lDQWdJQ0FnSUdSbFptRjFiSFE2SUhSb2NtOTNJRzVsZHlCRmNuSnZjaWduVlc1cGJYQnNaVzFsYm5SbFpDQjBlWEJsT2lBbklDc2dkSGx3WlNrN1hHNGdJQ0FnZlZ4dWZUdGNibHh1THk4Z1BUMDlJRmRTU1ZSSlRrY2dQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDFjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuZHlhWFJsVkdGbklEMGdablZ1WTNScGIyNG9kR0ZuTENCMGVYQmxLU0I3WEc0Z0lDQWdkR2hwY3k1M2NtbDBaVlpoY21sdWRDZ29kR0ZuSUR3OElETXBJSHdnZEhsd1pTazdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjbVZoYkd4dll5QTlJR1oxYm1OMGFXOXVLRzFwYmlrZ2UxeHVJQ0FnSUhaaGNpQnNaVzVuZEdnZ1BTQjBhR2x6TG1KMVppNXNaVzVuZEdnN1hHNGdJQ0FnZDJocGJHVWdLR3hsYm1kMGFDQThJSFJvYVhNdWNHOXpJQ3NnYldsdUtTQnNaVzVuZEdnZ0tqMGdNanRjYmlBZ0lDQnBaaUFvYkdWdVozUm9JQ0U5SUhSb2FYTXVZblZtTG14bGJtZDBhQ2tnZTF4dUlDQWdJQ0FnSUNCMllYSWdZblZtSUQwZ2JtVjNJRUoxWm1abGNpaHNaVzVuZEdncE8xeHVJQ0FnSUNBZ0lDQjBhR2x6TG1KMVppNWpiM0I1S0dKMVppazdYRzRnSUNBZ0lDQWdJSFJvYVhNdVluVm1JRDBnWW5WbU8xeHVJQ0FnSUgxY2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1bWFXNXBjMmdnUFNCbWRXNWpkR2x2YmlncElIdGNiaUFnSUNCeVpYUjFjbTRnZEdocGN5NWlkV1l1YzJ4cFkyVW9NQ3dnZEdocGN5NXdiM01wTzF4dWZUdGNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5keWFYUmxVR0ZqYTJWa0lEMGdablZ1WTNScGIyNG9kSGx3WlN3Z2RHRm5MQ0JwZEdWdGN5a2dlMXh1SUNBZ0lHbG1JQ2doYVhSbGJYTXViR1Z1WjNSb0tTQnlaWFIxY200N1hHNWNiaUFnSUNCMllYSWdiV1Z6YzJGblpTQTlJRzVsZHlCUWNtOTBiMkoxWmlncE8xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z2FYUmxiWE11YkdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lDQWdiV1Z6YzJGblpWc25kM0pwZEdVbklDc2dkSGx3WlYwb2FYUmxiWE5iYVYwcE8xeHVJQ0FnSUgxY2JpQWdJQ0IyWVhJZ1pHRjBZU0E5SUcxbGMzTmhaMlV1Wm1sdWFYTm9LQ2s3WEc1Y2JpQWdJQ0IwYUdsekxuZHlhWFJsVkdGbktIUmhaeXdnVUhKdmRHOWlkV1l1VUdGamEyVmtLVHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxRblZtWm1WeUtHUmhkR0VwTzF4dWZUdGNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5keWFYUmxWVWx1ZERNeUlEMGdablZ1WTNScGIyNG9kbUZzS1NCN1hHNGdJQ0FnZEdocGN5NXlaV0ZzYkc5aktEUXBPMXh1SUNBZ0lIUm9hWE11WW5WbUxuZHlhWFJsVlVsdWRETXlURVVvZG1Gc0xDQjBhR2x6TG5CdmN5azdYRzRnSUNBZ2RHaHBjeTV3YjNNZ0t6MGdORHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpWUmhaMmRsWkZWSmJuUXpNaUE5SUdaMWJtTjBhVzl1S0hSaFp5d2dkbUZzS1NCN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZSaFp5aDBZV2NzSUZCeWIzUnZZblZtTGtsdWRETXlLVHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxWVWx1ZERNeUtIWmhiQ2s3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1ZDNKcGRHVldZWEpwYm5RZ1BTQm1kVzVqZEdsdmJpaDJZV3dwSUh0Y2JpQWdJQ0IyWVd3Z1BTQk9kVzFpWlhJb2RtRnNLVHRjYmlBZ0lDQnBaaUFvYVhOT1lVNG9kbUZzS1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZV3dnUFNBd08xeHVJQ0FnSUgxY2JseHVJQ0FnSUdsbUlDaDJZV3dnUEQwZ01IZzNaaWtnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbkpsWVd4c2IyTW9NU2s3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVZblZtVzNSb2FYTXVjRzl6S3l0ZElEMGdkbUZzTzF4dUlDQWdJSDBnWld4elpTQnBaaUFvZG1Gc0lEdzlJREI0TTJabVppa2dlMXh1SUNBZ0lDQWdJQ0IwYUdsekxuSmxZV3hzYjJNb01pazdYRzRnSUNBZ0lDQWdJSFJvYVhNdVluVm1XM1JvYVhNdWNHOXpLeXRkSUQwZ01IZzRNQ0I4SUNnb2RtRnNJRDQrUGlBd0tTQW1JREI0TjJZcE8xeHVJQ0FnSUNBZ0lDQjBhR2x6TG1KMVpsdDBhR2x6TG5CdmN5c3JYU0E5SURCNE1EQWdmQ0FvS0haaGJDQStQajRnTnlrZ0ppQXdlRGRtS1R0Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0haaGJDQThQU0F3ZURGbVptWm1abVlwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV5WldGc2JHOWpLRE1wTzF4dUlDQWdJQ0FnSUNCMGFHbHpMbUoxWmx0MGFHbHpMbkJ2Y3lzclhTQTlJREI0T0RBZ2ZDQW9LSFpoYkNBK1BqNGdNQ2tnSmlBd2VEZG1LVHRjYmlBZ0lDQWdJQ0FnZEdocGN5NWlkV1piZEdocGN5NXdiM01ySzEwZ1BTQXdlRGd3SUh3Z0tDaDJZV3dnUGo0K0lEY3BJQ1lnTUhnM1ppazdYRzRnSUNBZ0lDQWdJSFJvYVhNdVluVm1XM1JvYVhNdWNHOXpLeXRkSUQwZ01IZ3dNQ0I4SUNnb2RtRnNJRDQrUGlBeE5Da2dKaUF3ZURkbUtUdGNiaUFnSUNCOUlHVnNjMlVnYVdZZ0tIWmhiQ0E4UFNBd2VHWm1abVptWm1ZcElIdGNiaUFnSUNBZ0lDQWdkR2hwY3k1eVpXRnNiRzlqS0RRcE8xeHVJQ0FnSUNBZ0lDQjBhR2x6TG1KMVpsdDBhR2x6TG5CdmN5c3JYU0E5SURCNE9EQWdmQ0FvS0haaGJDQStQajRnTUNrZ0ppQXdlRGRtS1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTVpZFdaYmRHaHBjeTV3YjNNcksxMGdQU0F3ZURnd0lId2dLQ2gyWVd3Z1BqNCtJRGNwSUNZZ01IZzNaaWs3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVZblZtVzNSb2FYTXVjRzl6S3l0ZElEMGdNSGc0TUNCOElDZ29kbUZzSUQ0K1BpQXhOQ2tnSmlBd2VEZG1LVHRjYmlBZ0lDQWdJQ0FnZEdocGN5NWlkV1piZEdocGN5NXdiM01ySzEwZ1BTQXdlREF3SUh3Z0tDaDJZV3dnUGo0K0lESXhLU0FtSURCNE4yWXBPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lIZG9hV3hsSUNoMllXd2dQaUF3S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ1lpQTlJSFpoYkNBbUlEQjROMlk3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjJZV3dnUFNCTllYUm9MbVpzYjI5eUtIWmhiQ0F2SURFeU9DazdYRzRnSUNBZ0lDQWdJQ0FnSUNCcFppQW9kbUZzSUQ0Z01Da2dZaUI4UFNBd2VEZ3dYRzRnSUNBZ0lDQWdJQ0FnSUNCMGFHbHpMbkpsWVd4c2IyTW9NU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjBhR2x6TG1KMVpsdDBhR2x6TG5CdmN5c3JYU0E5SUdJN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNCOVhHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWQzSnBkR1ZVWVdkblpXUldZWEpwYm5RZ1BTQm1kVzVqZEdsdmJpaDBZV2NzSUhaaGJDa2dlMXh1SUNBZ0lIUm9hWE11ZDNKcGRHVlVZV2NvZEdGbkxDQlFjbTkwYjJKMVppNVdZWEpwYm5RcE8xeHVJQ0FnSUhSb2FYTXVkM0pwZEdWV1lYSnBiblFvZG1Gc0tUdGNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNTNjbWwwWlZOV1lYSnBiblFnUFNCbWRXNWpkR2x2YmloMllXd3BJSHRjYmlBZ0lDQnBaaUFvZG1Gc0lENDlJREFwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTUzY21sMFpWWmhjbWx1ZENoMllXd2dLaUF5S1R0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0IwYUdsekxuZHlhWFJsVm1GeWFXNTBLSFpoYkNBcUlDMHlJQzBnTVNrN1hHNGdJQ0FnZlZ4dWZUdGNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5keWFYUmxWR0ZuWjJWa1UxWmhjbWx1ZENBOUlHWjFibU4wYVc5dUtIUmhaeXdnZG1Gc0tTQjdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWUmhaeWgwWVdjc0lGQnliM1J2WW5WbUxsWmhjbWx1ZENrN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZOV1lYSnBiblFvZG1Gc0tUdGNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNTNjbWwwWlVKdmIyeGxZVzRnUFNCbWRXNWpkR2x2YmloMllXd3BJSHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxWbUZ5YVc1MEtFSnZiMnhsWVc0b2RtRnNLU2s3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1ZDNKcGRHVlVZV2RuWldSQ2IyOXNaV0Z1SUQwZ1puVnVZM1JwYjI0b2RHRm5MQ0IyWVd3cElIdGNiaUFnSUNCMGFHbHpMbmR5YVhSbFZHRm5aMlZrVm1GeWFXNTBLSFJoWnl3Z1FtOXZiR1ZoYmloMllXd3BLVHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpWTjBjbWx1WnlBOUlHWjFibU4wYVc5dUtITjBjaWtnZTF4dUlDQWdJSE4wY2lBOUlGTjBjbWx1WnloemRISXBPMXh1SUNBZ0lIWmhjaUJpZVhSbGN5QTlJRUoxWm1abGNpNWllWFJsVEdWdVozUm9LSE4wY2lrN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZaaGNtbHVkQ2hpZVhSbGN5azdYRzRnSUNBZ2RHaHBjeTV5WldGc2JHOWpLR0o1ZEdWektUdGNiaUFnSUNCMGFHbHpMbUoxWmk1M2NtbDBaU2h6ZEhJc0lIUm9hWE11Y0c5ektUdGNiaUFnSUNCMGFHbHpMbkJ2Y3lBclBTQmllWFJsY3p0Y2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1M2NtbDBaVlJoWjJkbFpGTjBjbWx1WnlBOUlHWjFibU4wYVc5dUtIUmhaeXdnYzNSeUtTQjdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWUmhaeWgwWVdjc0lGQnliM1J2WW5WbUxsTjBjbWx1WnlrN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZOMGNtbHVaeWh6ZEhJcE8xeHVmVHRjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuZHlhWFJsUm14dllYUWdQU0JtZFc1amRHbHZiaWgyWVd3cElIdGNiaUFnSUNCMGFHbHpMbkpsWVd4c2IyTW9OQ2s3WEc0Z0lDQWdkR2hwY3k1aWRXWXVkM0pwZEdWR2JHOWhkRXhGS0haaGJDd2dkR2hwY3k1d2IzTXBPMXh1SUNBZ0lIUm9hWE11Y0c5eklDczlJRFE3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1ZDNKcGRHVlVZV2RuWldSR2JHOWhkQ0E5SUdaMWJtTjBhVzl1S0hSaFp5d2dkbUZzS1NCN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZSaFp5aDBZV2NzSUZCeWIzUnZZblZtTGtsdWRETXlLVHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxSbXh2WVhRb2RtRnNLVHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpVUnZkV0pzWlNBOUlHWjFibU4wYVc5dUtIWmhiQ2tnZTF4dUlDQWdJSFJvYVhNdWNtVmhiR3h2WXlnNEtUdGNiaUFnSUNCMGFHbHpMbUoxWmk1M2NtbDBaVVJ2ZFdKc1pVeEZLSFpoYkN3Z2RHaHBjeTV3YjNNcE8xeHVJQ0FnSUhSb2FYTXVjRzl6SUNzOUlEZzdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVkM0pwZEdWVVlXZG5aV1JFYjNWaWJHVWdQU0JtZFc1amRHbHZiaWgwWVdjc0lIWmhiQ2tnZTF4dUlDQWdJSFJvYVhNdWQzSnBkR1ZVWVdjb2RHRm5MQ0JRY205MGIySjFaaTVKYm5RMk5DazdYRzRnSUNBZ2RHaHBjeTUzY21sMFpVUnZkV0pzWlNoMllXd3BPMXh1ZlR0Y2JseHVVSEp2ZEc5aWRXWXVjSEp2ZEc5MGVYQmxMbmR5YVhSbFFuVm1abVZ5SUQwZ1puVnVZM1JwYjI0b1luVm1abVZ5S1NCN1hHNGdJQ0FnZG1GeUlHSjVkR1Z6SUQwZ1luVm1abVZ5TG14bGJtZDBhRHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxWbUZ5YVc1MEtHSjVkR1Z6S1R0Y2JpQWdJQ0IwYUdsekxuSmxZV3hzYjJNb1lubDBaWE1wTzF4dUlDQWdJR0oxWm1abGNpNWpiM0I1S0hSb2FYTXVZblZtTENCMGFHbHpMbkJ2Y3lrN1hHNGdJQ0FnZEdocGN5NXdiM01nS3owZ1lubDBaWE03WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1ZDNKcGRHVlVZV2RuWldSQ2RXWm1aWElnUFNCbWRXNWpkR2x2YmloMFlXY3NJR0oxWm1abGNpa2dlMXh1SUNBZ0lIUm9hWE11ZDNKcGRHVlVZV2NvZEdGbkxDQlFjbTkwYjJKMVppNVRkSEpwYm1jcE8xeHVJQ0FnSUhSb2FYTXVkM0pwZEdWQ2RXWm1aWElvWW5WbVptVnlLVHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpVMWxjM05oWjJVZ1BTQm1kVzVqZEdsdmJpaDBZV2NzSUhCeWIzUnZZblZtS1NCN1hHNGdJQ0FnZG1GeUlHSjFabVpsY2lBOUlIQnliM1J2WW5WbUxtWnBibWx6YUNncE8xeHVJQ0FnSUhSb2FYTXVkM0pwZEdWVVlXY29kR0ZuTENCUWNtOTBiMkoxWmk1TlpYTnpZV2RsS1R0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsUW5WbVptVnlLR0oxWm1abGNpazdYRzU5TzF4dUlsMTkiLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQb2ludDtcblxuZnVuY3Rpb24gUG9pbnQoeCwgeSkge1xuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbn1cblxuUG9pbnQucHJvdG90eXBlID0ge1xuICAgIGNsb25lOiBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBQb2ludCh0aGlzLngsIHRoaXMueSk7IH0sXG5cbiAgICBhZGQ6ICAgICBmdW5jdGlvbihwKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX2FkZChwKTsgICAgIH0sXG4gICAgc3ViOiAgICAgZnVuY3Rpb24ocCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9zdWIocCk7ICAgICB9LFxuICAgIG11bHQ6ICAgIGZ1bmN0aW9uKGspIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fbXVsdChrKTsgICAgfSxcbiAgICBkaXY6ICAgICBmdW5jdGlvbihrKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX2RpdihrKTsgICAgIH0sXG4gICAgcm90YXRlOiAgZnVuY3Rpb24oYSkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9yb3RhdGUoYSk7ICB9LFxuICAgIG1hdE11bHQ6IGZ1bmN0aW9uKG0pIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fbWF0TXVsdChtKTsgfSxcbiAgICB1bml0OiAgICBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fdW5pdCgpOyB9LFxuICAgIHBlcnA6ICAgIGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9wZXJwKCk7IH0sXG4gICAgcm91bmQ6ICAgZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX3JvdW5kKCk7IH0sXG5cbiAgICBtYWc6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ID09PSBwLnggJiZcbiAgICAgICAgICAgICAgIHRoaXMueSA9PT0gcC55O1xuICAgIH0sXG5cbiAgICBkaXN0OiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy5kaXN0U3FyKHApKTtcbiAgICB9LFxuXG4gICAgZGlzdFNxcjogZnVuY3Rpb24ocCkge1xuICAgICAgICB2YXIgZHggPSBwLnggLSB0aGlzLngsXG4gICAgICAgICAgICBkeSA9IHAueSAtIHRoaXMueTtcbiAgICAgICAgcmV0dXJuIGR4ICogZHggKyBkeSAqIGR5O1xuICAgIH0sXG5cbiAgICBhbmdsZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKHRoaXMueSwgdGhpcy54KTtcbiAgICB9LFxuXG4gICAgYW5nbGVUbzogZnVuY3Rpb24oYikge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMih0aGlzLnkgLSBiLnksIHRoaXMueCAtIGIueCk7XG4gICAgfSxcblxuICAgIGFuZ2xlV2l0aDogZnVuY3Rpb24oYikge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmdsZVdpdGhTZXAoYi54LCBiLnkpO1xuICAgIH0sXG5cbiAgICAvLyBGaW5kIHRoZSBhbmdsZSBvZiB0aGUgdHdvIHZlY3RvcnMsIHNvbHZpbmcgdGhlIGZvcm11bGEgZm9yIHRoZSBjcm9zcyBwcm9kdWN0IGEgeCBiID0gfGF8fGJ8c2luKM64KSBmb3IgzrguXG4gICAgYW5nbGVXaXRoU2VwOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKFxuICAgICAgICAgICAgdGhpcy54ICogeSAtIHRoaXMueSAqIHgsXG4gICAgICAgICAgICB0aGlzLnggKiB4ICsgdGhpcy55ICogeSk7XG4gICAgfSxcblxuICAgIF9tYXRNdWx0OiBmdW5jdGlvbihtKSB7XG4gICAgICAgIHZhciB4ID0gbVswXSAqIHRoaXMueCArIG1bMV0gKiB0aGlzLnksXG4gICAgICAgICAgICB5ID0gbVsyXSAqIHRoaXMueCArIG1bM10gKiB0aGlzLnk7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfYWRkOiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHRoaXMueCArPSBwLng7XG4gICAgICAgIHRoaXMueSArPSBwLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfc3ViOiBmdW5jdGlvbihwKSB7XG4gICAgICAgIHRoaXMueCAtPSBwLng7XG4gICAgICAgIHRoaXMueSAtPSBwLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfbXVsdDogZnVuY3Rpb24oaykge1xuICAgICAgICB0aGlzLnggKj0gaztcbiAgICAgICAgdGhpcy55ICo9IGs7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfZGl2OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHRoaXMueCAvPSBrO1xuICAgICAgICB0aGlzLnkgLz0gaztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF91bml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZGl2KHRoaXMubWFnKCkpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX3BlcnA6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgeSA9IHRoaXMueTtcbiAgICAgICAgdGhpcy55ID0gdGhpcy54O1xuICAgICAgICB0aGlzLnggPSAteTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9yb3RhdGU6IGZ1bmN0aW9uKGFuZ2xlKSB7XG4gICAgICAgIHZhciBjb3MgPSBNYXRoLmNvcyhhbmdsZSksXG4gICAgICAgICAgICBzaW4gPSBNYXRoLnNpbihhbmdsZSksXG4gICAgICAgICAgICB4ID0gY29zICogdGhpcy54IC0gc2luICogdGhpcy55LFxuICAgICAgICAgICAgeSA9IHNpbiAqIHRoaXMueCArIGNvcyAqIHRoaXMueTtcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9yb3VuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGgucm91bmQodGhpcy54KTtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yb3VuZCh0aGlzLnkpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG4vLyBjb25zdHJ1Y3RzIFBvaW50IGZyb20gYW4gYXJyYXkgaWYgbmVjZXNzYXJ5XG5Qb2ludC5jb252ZXJ0ID0gZnVuY3Rpb24gKGEpIHtcbiAgICBpZiAoYSBpbnN0YW5jZW9mIFBvaW50KSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KGFbMF0sIGFbMV0pO1xuICAgIH1cbiAgICByZXR1cm4gYTtcbn07XG4iLCIvKlxuIChjKSAyMDE1LCBWbGFkaW1pciBBZ2Fmb25raW5cbiBSQnVzaCwgYSBKYXZhU2NyaXB0IGxpYnJhcnkgZm9yIGhpZ2gtcGVyZm9ybWFuY2UgMkQgc3BhdGlhbCBpbmRleGluZyBvZiBwb2ludHMgYW5kIHJlY3RhbmdsZXMuXG4gaHR0cHM6Ly9naXRodWIuY29tL21vdXJuZXIvcmJ1c2hcbiovXG5cbihmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gcmJ1c2gobWF4RW50cmllcywgZm9ybWF0KSB7XG5cbiAgICAvLyBqc2hpbnQgbmV3Y2FwOiBmYWxzZSwgdmFsaWR0aGlzOiB0cnVlXG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIHJidXNoKSkgcmV0dXJuIG5ldyByYnVzaChtYXhFbnRyaWVzLCBmb3JtYXQpO1xuXG4gICAgLy8gbWF4IGVudHJpZXMgaW4gYSBub2RlIGlzIDkgYnkgZGVmYXVsdDsgbWluIG5vZGUgZmlsbCBpcyA0MCUgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGlzLl9tYXhFbnRyaWVzID0gTWF0aC5tYXgoNCwgbWF4RW50cmllcyB8fCA5KTtcbiAgICB0aGlzLl9taW5FbnRyaWVzID0gTWF0aC5tYXgoMiwgTWF0aC5jZWlsKHRoaXMuX21heEVudHJpZXMgKiAwLjQpKTtcblxuICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy5faW5pdEZvcm1hdChmb3JtYXQpO1xuICAgIH1cblxuICAgIHRoaXMuY2xlYXIoKTtcbn1cblxucmJ1c2gucHJvdG90eXBlID0ge1xuXG4gICAgYWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbGwodGhpcy5kYXRhLCBbXSk7XG4gICAgfSxcblxuICAgIHNlYXJjaDogZnVuY3Rpb24gKGJib3gpIHtcblxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZGF0YSxcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICAgICAgdG9CQm94ID0gdGhpcy50b0JCb3g7XG5cbiAgICAgICAgaWYgKCFpbnRlcnNlY3RzKGJib3gsIG5vZGUuYmJveCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgICAgdmFyIG5vZGVzVG9TZWFyY2ggPSBbXSxcbiAgICAgICAgICAgIGksIGxlbiwgY2hpbGQsIGNoaWxkQkJveDtcblxuICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgIGNoaWxkQkJveCA9IG5vZGUubGVhZiA/IHRvQkJveChjaGlsZCkgOiBjaGlsZC5iYm94O1xuXG4gICAgICAgICAgICAgICAgaWYgKGludGVyc2VjdHMoYmJveCwgY2hpbGRCQm94KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5sZWFmKSByZXN1bHQucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnRhaW5zKGJib3gsIGNoaWxkQkJveCkpIHRoaXMuX2FsbChjaGlsZCwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBub2Rlc1RvU2VhcmNoLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2Rlc1RvU2VhcmNoLnBvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgY29sbGlkZXM6IGZ1bmN0aW9uIChiYm94KSB7XG5cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICB0b0JCb3ggPSB0aGlzLnRvQkJveDtcblxuICAgICAgICBpZiAoIWludGVyc2VjdHMoYmJveCwgbm9kZS5iYm94KSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHZhciBub2Rlc1RvU2VhcmNoID0gW10sXG4gICAgICAgICAgICBpLCBsZW4sIGNoaWxkLCBjaGlsZEJCb3g7XG5cbiAgICAgICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBjaGlsZEJCb3ggPSBub2RlLmxlYWYgPyB0b0JCb3goY2hpbGQpIDogY2hpbGQuYmJveDtcblxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnNlY3RzKGJib3gsIGNoaWxkQkJveCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubGVhZiB8fCBjb250YWlucyhiYm94LCBjaGlsZEJCb3gpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZXNUb1NlYXJjaC5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZXNUb1NlYXJjaC5wb3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgbG9hZDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKCEoZGF0YSAmJiBkYXRhLmxlbmd0aCkpIHJldHVybiB0aGlzO1xuXG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCA8IHRoaXMuX21pbkVudHJpZXMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBkYXRhLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnNlcnQoZGF0YVtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlY3Vyc2l2ZWx5IGJ1aWxkIHRoZSB0cmVlIHdpdGggdGhlIGdpdmVuIGRhdGEgZnJvbSBzdHJhdGNoIHVzaW5nIE9NVCBhbGdvcml0aG1cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9idWlsZChkYXRhLnNsaWNlKCksIDAsIGRhdGEubGVuZ3RoIC0gMSwgMCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRhdGEuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBzYXZlIGFzIGlzIGlmIHRyZWUgaXMgZW1wdHlcbiAgICAgICAgICAgIHRoaXMuZGF0YSA9IG5vZGU7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRhdGEuaGVpZ2h0ID09PSBub2RlLmhlaWdodCkge1xuICAgICAgICAgICAgLy8gc3BsaXQgcm9vdCBpZiB0cmVlcyBoYXZlIHRoZSBzYW1lIGhlaWdodFxuICAgICAgICAgICAgdGhpcy5fc3BsaXRSb290KHRoaXMuZGF0YSwgbm9kZSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuaGVpZ2h0IDwgbm9kZS5oZWlnaHQpIHtcbiAgICAgICAgICAgICAgICAvLyBzd2FwIHRyZWVzIGlmIGluc2VydGVkIG9uZSBpcyBiaWdnZXJcbiAgICAgICAgICAgICAgICB2YXIgdG1wTm9kZSA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSBub2RlO1xuICAgICAgICAgICAgICAgIG5vZGUgPSB0bXBOb2RlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpbnNlcnQgdGhlIHNtYWxsIHRyZWUgaW50byB0aGUgbGFyZ2UgdHJlZSBhdCBhcHByb3ByaWF0ZSBsZXZlbFxuICAgICAgICAgICAgdGhpcy5faW5zZXJ0KG5vZGUsIHRoaXMuZGF0YS5oZWlnaHQgLSBub2RlLmhlaWdodCAtIDEsIHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIGluc2VydDogZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgaWYgKGl0ZW0pIHRoaXMuX2luc2VydChpdGVtLCB0aGlzLmRhdGEuaGVpZ2h0IC0gMSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBjbGVhcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmRhdGEgPSB7XG4gICAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgICAgICBiYm94OiBlbXB0eSgpLFxuICAgICAgICAgICAgbGVhZjogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgcmVtb3ZlOiBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICBpZiAoIWl0ZW0pIHJldHVybiB0aGlzO1xuXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5kYXRhLFxuICAgICAgICAgICAgYmJveCA9IHRoaXMudG9CQm94KGl0ZW0pLFxuICAgICAgICAgICAgcGF0aCA9IFtdLFxuICAgICAgICAgICAgaW5kZXhlcyA9IFtdLFxuICAgICAgICAgICAgaSwgcGFyZW50LCBpbmRleCwgZ29pbmdVcDtcblxuICAgICAgICAvLyBkZXB0aC1maXJzdCBpdGVyYXRpdmUgdHJlZSB0cmF2ZXJzYWxcbiAgICAgICAgd2hpbGUgKG5vZGUgfHwgcGF0aC5sZW5ndGgpIHtcblxuICAgICAgICAgICAgaWYgKCFub2RlKSB7IC8vIGdvIHVwXG4gICAgICAgICAgICAgICAgbm9kZSA9IHBhdGgucG9wKCk7XG4gICAgICAgICAgICAgICAgcGFyZW50ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgIGkgPSBpbmRleGVzLnBvcCgpO1xuICAgICAgICAgICAgICAgIGdvaW5nVXAgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobm9kZS5sZWFmKSB7IC8vIGNoZWNrIGN1cnJlbnQgbm9kZVxuICAgICAgICAgICAgICAgIGluZGV4ID0gbm9kZS5jaGlsZHJlbi5pbmRleE9mKGl0ZW0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpdGVtIGZvdW5kLCByZW1vdmUgdGhlIGl0ZW0gYW5kIGNvbmRlbnNlIHRyZWUgdXB3YXJkc1xuICAgICAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHBhdGgucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29uZGVuc2UocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFnb2luZ1VwICYmICFub2RlLmxlYWYgJiYgY29udGFpbnMobm9kZS5iYm94LCBiYm94KSkgeyAvLyBnbyBkb3duXG4gICAgICAgICAgICAgICAgcGF0aC5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBub2RlO1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLmNoaWxkcmVuWzBdO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhcmVudCkgeyAvLyBnbyByaWdodFxuICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgICAgICBub2RlID0gcGFyZW50LmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgIGdvaW5nVXAgPSBmYWxzZTtcblxuICAgICAgICAgICAgfSBlbHNlIG5vZGUgPSBudWxsOyAvLyBub3RoaW5nIGZvdW5kXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgdG9CQm94OiBmdW5jdGlvbiAoaXRlbSkgeyByZXR1cm4gaXRlbTsgfSxcblxuICAgIGNvbXBhcmVNaW5YOiBmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYVswXSAtIGJbMF07IH0sXG4gICAgY29tcGFyZU1pblk6IGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBhWzFdIC0gYlsxXTsgfSxcblxuICAgIHRvSlNPTjogZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpcy5kYXRhOyB9LFxuXG4gICAgZnJvbUpTT046IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfYWxsOiBmdW5jdGlvbiAobm9kZSwgcmVzdWx0KSB7XG4gICAgICAgIHZhciBub2Rlc1RvU2VhcmNoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5sZWFmKSByZXN1bHQucHVzaC5hcHBseShyZXN1bHQsIG5vZGUuY2hpbGRyZW4pO1xuICAgICAgICAgICAgZWxzZSBub2Rlc1RvU2VhcmNoLnB1c2guYXBwbHkobm9kZXNUb1NlYXJjaCwgbm9kZS5jaGlsZHJlbik7XG5cbiAgICAgICAgICAgIG5vZGUgPSBub2Rlc1RvU2VhcmNoLnBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIF9idWlsZDogZnVuY3Rpb24gKGl0ZW1zLCBsZWZ0LCByaWdodCwgaGVpZ2h0KSB7XG5cbiAgICAgICAgdmFyIE4gPSByaWdodCAtIGxlZnQgKyAxLFxuICAgICAgICAgICAgTSA9IHRoaXMuX21heEVudHJpZXMsXG4gICAgICAgICAgICBub2RlO1xuXG4gICAgICAgIGlmIChOIDw9IE0pIHtcbiAgICAgICAgICAgIC8vIHJlYWNoZWQgbGVhZiBsZXZlbDsgcmV0dXJuIGxlYWZcbiAgICAgICAgICAgIG5vZGUgPSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IGl0ZW1zLnNsaWNlKGxlZnQsIHJpZ2h0ICsgMSksXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICAgICAgICAgIGJib3g6IG51bGwsXG4gICAgICAgICAgICAgICAgbGVhZjogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhbGNCQm94KG5vZGUsIHRoaXMudG9CQm94KTtcbiAgICAgICAgICAgIHJldHVybiBub2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFoZWlnaHQpIHtcbiAgICAgICAgICAgIC8vIHRhcmdldCBoZWlnaHQgb2YgdGhlIGJ1bGstbG9hZGVkIHRyZWVcbiAgICAgICAgICAgIGhlaWdodCA9IE1hdGguY2VpbChNYXRoLmxvZyhOKSAvIE1hdGgubG9nKE0pKTtcblxuICAgICAgICAgICAgLy8gdGFyZ2V0IG51bWJlciBvZiByb290IGVudHJpZXMgdG8gbWF4aW1pemUgc3RvcmFnZSB1dGlsaXphdGlvblxuICAgICAgICAgICAgTSA9IE1hdGguY2VpbChOIC8gTWF0aC5wb3coTSwgaGVpZ2h0IC0gMSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyBlbGltaW5hdGUgcmVjdXJzaW9uP1xuXG4gICAgICAgIG5vZGUgPSB7XG4gICAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGJib3g6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzcGxpdCB0aGUgaXRlbXMgaW50byBNIG1vc3RseSBzcXVhcmUgdGlsZXNcblxuICAgICAgICB2YXIgTjIgPSBNYXRoLmNlaWwoTiAvIE0pLFxuICAgICAgICAgICAgTjEgPSBOMiAqIE1hdGguY2VpbChNYXRoLnNxcnQoTSkpLFxuICAgICAgICAgICAgaSwgaiwgcmlnaHQyLCByaWdodDM7XG5cbiAgICAgICAgbXVsdGlTZWxlY3QoaXRlbXMsIGxlZnQsIHJpZ2h0LCBOMSwgdGhpcy5jb21wYXJlTWluWCk7XG5cbiAgICAgICAgZm9yIChpID0gbGVmdDsgaSA8PSByaWdodDsgaSArPSBOMSkge1xuXG4gICAgICAgICAgICByaWdodDIgPSBNYXRoLm1pbihpICsgTjEgLSAxLCByaWdodCk7XG5cbiAgICAgICAgICAgIG11bHRpU2VsZWN0KGl0ZW1zLCBpLCByaWdodDIsIE4yLCB0aGlzLmNvbXBhcmVNaW5ZKTtcblxuICAgICAgICAgICAgZm9yIChqID0gaTsgaiA8PSByaWdodDI7IGogKz0gTjIpIHtcblxuICAgICAgICAgICAgICAgIHJpZ2h0MyA9IE1hdGgubWluKGogKyBOMiAtIDEsIHJpZ2h0Mik7XG5cbiAgICAgICAgICAgICAgICAvLyBwYWNrIGVhY2ggZW50cnkgcmVjdXJzaXZlbHlcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLnB1c2godGhpcy5fYnVpbGQoaXRlbXMsIGosIHJpZ2h0MywgaGVpZ2h0IC0gMSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2FsY0JCb3gobm9kZSwgdGhpcy50b0JCb3gpO1xuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG5cbiAgICBfY2hvb3NlU3VidHJlZTogZnVuY3Rpb24gKGJib3gsIG5vZGUsIGxldmVsLCBwYXRoKSB7XG5cbiAgICAgICAgdmFyIGksIGxlbiwgY2hpbGQsIHRhcmdldE5vZGUsIGFyZWEsIGVubGFyZ2VtZW50LCBtaW5BcmVhLCBtaW5FbmxhcmdlbWVudDtcblxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgcGF0aC5wdXNoKG5vZGUpO1xuXG4gICAgICAgICAgICBpZiAobm9kZS5sZWFmIHx8IHBhdGgubGVuZ3RoIC0gMSA9PT0gbGV2ZWwpIGJyZWFrO1xuXG4gICAgICAgICAgICBtaW5BcmVhID0gbWluRW5sYXJnZW1lbnQgPSBJbmZpbml0eTtcblxuICAgICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBhcmVhID0gYmJveEFyZWEoY2hpbGQuYmJveCk7XG4gICAgICAgICAgICAgICAgZW5sYXJnZW1lbnQgPSBlbmxhcmdlZEFyZWEoYmJveCwgY2hpbGQuYmJveCkgLSBhcmVhO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hvb3NlIGVudHJ5IHdpdGggdGhlIGxlYXN0IGFyZWEgZW5sYXJnZW1lbnRcbiAgICAgICAgICAgICAgICBpZiAoZW5sYXJnZW1lbnQgPCBtaW5FbmxhcmdlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBtaW5FbmxhcmdlbWVudCA9IGVubGFyZ2VtZW50O1xuICAgICAgICAgICAgICAgICAgICBtaW5BcmVhID0gYXJlYSA8IG1pbkFyZWEgPyBhcmVhIDogbWluQXJlYTtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0Tm9kZSA9IGNoaWxkO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbmxhcmdlbWVudCA9PT0gbWluRW5sYXJnZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGNob29zZSBvbmUgd2l0aCB0aGUgc21hbGxlc3QgYXJlYVxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJlYSA8IG1pbkFyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbkFyZWEgPSBhcmVhO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0Tm9kZSA9IGNoaWxkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlID0gdGFyZ2V0Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG5cbiAgICBfaW5zZXJ0OiBmdW5jdGlvbiAoaXRlbSwgbGV2ZWwsIGlzTm9kZSkge1xuXG4gICAgICAgIHZhciB0b0JCb3ggPSB0aGlzLnRvQkJveCxcbiAgICAgICAgICAgIGJib3ggPSBpc05vZGUgPyBpdGVtLmJib3ggOiB0b0JCb3goaXRlbSksXG4gICAgICAgICAgICBpbnNlcnRQYXRoID0gW107XG5cbiAgICAgICAgLy8gZmluZCB0aGUgYmVzdCBub2RlIGZvciBhY2NvbW1vZGF0aW5nIHRoZSBpdGVtLCBzYXZpbmcgYWxsIG5vZGVzIGFsb25nIHRoZSBwYXRoIHRvb1xuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuX2Nob29zZVN1YnRyZWUoYmJveCwgdGhpcy5kYXRhLCBsZXZlbCwgaW5zZXJ0UGF0aCk7XG5cbiAgICAgICAgLy8gcHV0IHRoZSBpdGVtIGludG8gdGhlIG5vZGVcbiAgICAgICAgbm9kZS5jaGlsZHJlbi5wdXNoKGl0ZW0pO1xuICAgICAgICBleHRlbmQobm9kZS5iYm94LCBiYm94KTtcblxuICAgICAgICAvLyBzcGxpdCBvbiBub2RlIG92ZXJmbG93OyBwcm9wYWdhdGUgdXB3YXJkcyBpZiBuZWNlc3NhcnlcbiAgICAgICAgd2hpbGUgKGxldmVsID49IDApIHtcbiAgICAgICAgICAgIGlmIChpbnNlcnRQYXRoW2xldmVsXS5jaGlsZHJlbi5sZW5ndGggPiB0aGlzLl9tYXhFbnRyaWVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3BsaXQoaW5zZXJ0UGF0aCwgbGV2ZWwpO1xuICAgICAgICAgICAgICAgIGxldmVsLS07XG4gICAgICAgICAgICB9IGVsc2UgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGp1c3QgYmJveGVzIGFsb25nIHRoZSBpbnNlcnRpb24gcGF0aFxuICAgICAgICB0aGlzLl9hZGp1c3RQYXJlbnRCQm94ZXMoYmJveCwgaW5zZXJ0UGF0aCwgbGV2ZWwpO1xuICAgIH0sXG5cbiAgICAvLyBzcGxpdCBvdmVyZmxvd2VkIG5vZGUgaW50byB0d29cbiAgICBfc3BsaXQ6IGZ1bmN0aW9uIChpbnNlcnRQYXRoLCBsZXZlbCkge1xuXG4gICAgICAgIHZhciBub2RlID0gaW5zZXJ0UGF0aFtsZXZlbF0sXG4gICAgICAgICAgICBNID0gbm9kZS5jaGlsZHJlbi5sZW5ndGgsXG4gICAgICAgICAgICBtID0gdGhpcy5fbWluRW50cmllcztcblxuICAgICAgICB0aGlzLl9jaG9vc2VTcGxpdEF4aXMobm9kZSwgbSwgTSk7XG5cbiAgICAgICAgdmFyIHNwbGl0SW5kZXggPSB0aGlzLl9jaG9vc2VTcGxpdEluZGV4KG5vZGUsIG0sIE0pO1xuXG4gICAgICAgIHZhciBuZXdOb2RlID0ge1xuICAgICAgICAgICAgY2hpbGRyZW46IG5vZGUuY2hpbGRyZW4uc3BsaWNlKHNwbGl0SW5kZXgsIG5vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gc3BsaXRJbmRleCksXG4gICAgICAgICAgICBoZWlnaHQ6IG5vZGUuaGVpZ2h0XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG5vZGUubGVhZikgbmV3Tm9kZS5sZWFmID0gdHJ1ZTtcblxuICAgICAgICBjYWxjQkJveChub2RlLCB0aGlzLnRvQkJveCk7XG4gICAgICAgIGNhbGNCQm94KG5ld05vZGUsIHRoaXMudG9CQm94KTtcblxuICAgICAgICBpZiAobGV2ZWwpIGluc2VydFBhdGhbbGV2ZWwgLSAxXS5jaGlsZHJlbi5wdXNoKG5ld05vZGUpO1xuICAgICAgICBlbHNlIHRoaXMuX3NwbGl0Um9vdChub2RlLCBuZXdOb2RlKTtcbiAgICB9LFxuXG4gICAgX3NwbGl0Um9vdDogZnVuY3Rpb24gKG5vZGUsIG5ld05vZGUpIHtcbiAgICAgICAgLy8gc3BsaXQgcm9vdCBub2RlXG4gICAgICAgIHRoaXMuZGF0YSA9IHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbbm9kZSwgbmV3Tm9kZV0sXG4gICAgICAgICAgICBoZWlnaHQ6IG5vZGUuaGVpZ2h0ICsgMVxuICAgICAgICB9O1xuICAgICAgICBjYWxjQkJveCh0aGlzLmRhdGEsIHRoaXMudG9CQm94KTtcbiAgICB9LFxuXG4gICAgX2Nob29zZVNwbGl0SW5kZXg6IGZ1bmN0aW9uIChub2RlLCBtLCBNKSB7XG5cbiAgICAgICAgdmFyIGksIGJib3gxLCBiYm94Miwgb3ZlcmxhcCwgYXJlYSwgbWluT3ZlcmxhcCwgbWluQXJlYSwgaW5kZXg7XG5cbiAgICAgICAgbWluT3ZlcmxhcCA9IG1pbkFyZWEgPSBJbmZpbml0eTtcblxuICAgICAgICBmb3IgKGkgPSBtOyBpIDw9IE0gLSBtOyBpKyspIHtcbiAgICAgICAgICAgIGJib3gxID0gZGlzdEJCb3gobm9kZSwgMCwgaSwgdGhpcy50b0JCb3gpO1xuICAgICAgICAgICAgYmJveDIgPSBkaXN0QkJveChub2RlLCBpLCBNLCB0aGlzLnRvQkJveCk7XG5cbiAgICAgICAgICAgIG92ZXJsYXAgPSBpbnRlcnNlY3Rpb25BcmVhKGJib3gxLCBiYm94Mik7XG4gICAgICAgICAgICBhcmVhID0gYmJveEFyZWEoYmJveDEpICsgYmJveEFyZWEoYmJveDIpO1xuXG4gICAgICAgICAgICAvLyBjaG9vc2UgZGlzdHJpYnV0aW9uIHdpdGggbWluaW11bSBvdmVybGFwXG4gICAgICAgICAgICBpZiAob3ZlcmxhcCA8IG1pbk92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwID0gb3ZlcmxhcDtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG5cbiAgICAgICAgICAgICAgICBtaW5BcmVhID0gYXJlYSA8IG1pbkFyZWEgPyBhcmVhIDogbWluQXJlYTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChvdmVybGFwID09PSBtaW5PdmVybGFwKSB7XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGNob29zZSBkaXN0cmlidXRpb24gd2l0aCBtaW5pbXVtIGFyZWFcbiAgICAgICAgICAgICAgICBpZiAoYXJlYSA8IG1pbkFyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgbWluQXJlYSA9IGFyZWE7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgfSxcblxuICAgIC8vIHNvcnRzIG5vZGUgY2hpbGRyZW4gYnkgdGhlIGJlc3QgYXhpcyBmb3Igc3BsaXRcbiAgICBfY2hvb3NlU3BsaXRBeGlzOiBmdW5jdGlvbiAobm9kZSwgbSwgTSkge1xuXG4gICAgICAgIHZhciBjb21wYXJlTWluWCA9IG5vZGUubGVhZiA/IHRoaXMuY29tcGFyZU1pblggOiBjb21wYXJlTm9kZU1pblgsXG4gICAgICAgICAgICBjb21wYXJlTWluWSA9IG5vZGUubGVhZiA/IHRoaXMuY29tcGFyZU1pblkgOiBjb21wYXJlTm9kZU1pblksXG4gICAgICAgICAgICB4TWFyZ2luID0gdGhpcy5fYWxsRGlzdE1hcmdpbihub2RlLCBtLCBNLCBjb21wYXJlTWluWCksXG4gICAgICAgICAgICB5TWFyZ2luID0gdGhpcy5fYWxsRGlzdE1hcmdpbihub2RlLCBtLCBNLCBjb21wYXJlTWluWSk7XG5cbiAgICAgICAgLy8gaWYgdG90YWwgZGlzdHJpYnV0aW9ucyBtYXJnaW4gdmFsdWUgaXMgbWluaW1hbCBmb3IgeCwgc29ydCBieSBtaW5YLFxuICAgICAgICAvLyBvdGhlcndpc2UgaXQncyBhbHJlYWR5IHNvcnRlZCBieSBtaW5ZXG4gICAgICAgIGlmICh4TWFyZ2luIDwgeU1hcmdpbikgbm9kZS5jaGlsZHJlbi5zb3J0KGNvbXBhcmVNaW5YKTtcbiAgICB9LFxuXG4gICAgLy8gdG90YWwgbWFyZ2luIG9mIGFsbCBwb3NzaWJsZSBzcGxpdCBkaXN0cmlidXRpb25zIHdoZXJlIGVhY2ggbm9kZSBpcyBhdCBsZWFzdCBtIGZ1bGxcbiAgICBfYWxsRGlzdE1hcmdpbjogZnVuY3Rpb24gKG5vZGUsIG0sIE0sIGNvbXBhcmUpIHtcblxuICAgICAgICBub2RlLmNoaWxkcmVuLnNvcnQoY29tcGFyZSk7XG5cbiAgICAgICAgdmFyIHRvQkJveCA9IHRoaXMudG9CQm94LFxuICAgICAgICAgICAgbGVmdEJCb3ggPSBkaXN0QkJveChub2RlLCAwLCBtLCB0b0JCb3gpLFxuICAgICAgICAgICAgcmlnaHRCQm94ID0gZGlzdEJCb3gobm9kZSwgTSAtIG0sIE0sIHRvQkJveCksXG4gICAgICAgICAgICBtYXJnaW4gPSBiYm94TWFyZ2luKGxlZnRCQm94KSArIGJib3hNYXJnaW4ocmlnaHRCQm94KSxcbiAgICAgICAgICAgIGksIGNoaWxkO1xuXG4gICAgICAgIGZvciAoaSA9IG07IGkgPCBNIC0gbTsgaSsrKSB7XG4gICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICBleHRlbmQobGVmdEJCb3gsIG5vZGUubGVhZiA/IHRvQkJveChjaGlsZCkgOiBjaGlsZC5iYm94KTtcbiAgICAgICAgICAgIG1hcmdpbiArPSBiYm94TWFyZ2luKGxlZnRCQm94KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IE0gLSBtIC0gMTsgaSA+PSBtOyBpLS0pIHtcbiAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGV4dGVuZChyaWdodEJCb3gsIG5vZGUubGVhZiA/IHRvQkJveChjaGlsZCkgOiBjaGlsZC5iYm94KTtcbiAgICAgICAgICAgIG1hcmdpbiArPSBiYm94TWFyZ2luKHJpZ2h0QkJveCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWFyZ2luO1xuICAgIH0sXG5cbiAgICBfYWRqdXN0UGFyZW50QkJveGVzOiBmdW5jdGlvbiAoYmJveCwgcGF0aCwgbGV2ZWwpIHtcbiAgICAgICAgLy8gYWRqdXN0IGJib3hlcyBhbG9uZyB0aGUgZ2l2ZW4gdHJlZSBwYXRoXG4gICAgICAgIGZvciAodmFyIGkgPSBsZXZlbDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGV4dGVuZChwYXRoW2ldLmJib3gsIGJib3gpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9jb25kZW5zZTogZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgLy8gZ28gdGhyb3VnaCB0aGUgcGF0aCwgcmVtb3ZpbmcgZW1wdHkgbm9kZXMgYW5kIHVwZGF0aW5nIGJib3hlc1xuICAgICAgICBmb3IgKHZhciBpID0gcGF0aC5sZW5ndGggLSAxLCBzaWJsaW5nczsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGlmIChwYXRoW2ldLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5ncyA9IHBhdGhbaSAtIDFdLmNoaWxkcmVuO1xuICAgICAgICAgICAgICAgICAgICBzaWJsaW5ncy5zcGxpY2Uoc2libGluZ3MuaW5kZXhPZihwYXRoW2ldKSwgMSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgdGhpcy5jbGVhcigpO1xuXG4gICAgICAgICAgICB9IGVsc2UgY2FsY0JCb3gocGF0aFtpXSwgdGhpcy50b0JCb3gpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9pbml0Rm9ybWF0OiBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIC8vIGRhdGEgZm9ybWF0IChtaW5YLCBtaW5ZLCBtYXhYLCBtYXhZIGFjY2Vzc29ycylcblxuICAgICAgICAvLyB1c2VzIGV2YWwtdHlwZSBmdW5jdGlvbiBjb21waWxhdGlvbiBpbnN0ZWFkIG9mIGp1c3QgYWNjZXB0aW5nIGEgdG9CQm94IGZ1bmN0aW9uXG4gICAgICAgIC8vIGJlY2F1c2UgdGhlIGFsZ29yaXRobXMgYXJlIHZlcnkgc2Vuc2l0aXZlIHRvIHNvcnRpbmcgZnVuY3Rpb25zIHBlcmZvcm1hbmNlLFxuICAgICAgICAvLyBzbyB0aGV5IHNob3VsZCBiZSBkZWFkIHNpbXBsZSBhbmQgd2l0aG91dCBpbm5lciBjYWxsc1xuXG4gICAgICAgIC8vIGpzaGludCBldmlsOiB0cnVlXG5cbiAgICAgICAgdmFyIGNvbXBhcmVBcnIgPSBbJ3JldHVybiBhJywgJyAtIGInLCAnOyddO1xuXG4gICAgICAgIHRoaXMuY29tcGFyZU1pblggPSBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGNvbXBhcmVBcnIuam9pbihmb3JtYXRbMF0pKTtcbiAgICAgICAgdGhpcy5jb21wYXJlTWluWSA9IG5ldyBGdW5jdGlvbignYScsICdiJywgY29tcGFyZUFyci5qb2luKGZvcm1hdFsxXSkpO1xuXG4gICAgICAgIHRoaXMudG9CQm94ID0gbmV3IEZ1bmN0aW9uKCdhJywgJ3JldHVybiBbYScgKyBmb3JtYXQuam9pbignLCBhJykgKyAnXTsnKTtcbiAgICB9XG59O1xuXG5cbi8vIGNhbGN1bGF0ZSBub2RlJ3MgYmJveCBmcm9tIGJib3hlcyBvZiBpdHMgY2hpbGRyZW5cbmZ1bmN0aW9uIGNhbGNCQm94KG5vZGUsIHRvQkJveCkge1xuICAgIG5vZGUuYmJveCA9IGRpc3RCQm94KG5vZGUsIDAsIG5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB0b0JCb3gpO1xufVxuXG4vLyBtaW4gYm91bmRpbmcgcmVjdGFuZ2xlIG9mIG5vZGUgY2hpbGRyZW4gZnJvbSBrIHRvIHAtMVxuZnVuY3Rpb24gZGlzdEJCb3gobm9kZSwgaywgcCwgdG9CQm94KSB7XG4gICAgdmFyIGJib3ggPSBlbXB0eSgpO1xuXG4gICAgZm9yICh2YXIgaSA9IGssIGNoaWxkOyBpIDwgcDsgaSsrKSB7XG4gICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgZXh0ZW5kKGJib3gsIG5vZGUubGVhZiA/IHRvQkJveChjaGlsZCkgOiBjaGlsZC5iYm94KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYmJveDtcbn1cblxuZnVuY3Rpb24gZW1wdHkoKSB7IHJldHVybiBbSW5maW5pdHksIEluZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eV07IH1cblxuZnVuY3Rpb24gZXh0ZW5kKGEsIGIpIHtcbiAgICBhWzBdID0gTWF0aC5taW4oYVswXSwgYlswXSk7XG4gICAgYVsxXSA9IE1hdGgubWluKGFbMV0sIGJbMV0pO1xuICAgIGFbMl0gPSBNYXRoLm1heChhWzJdLCBiWzJdKTtcbiAgICBhWzNdID0gTWF0aC5tYXgoYVszXSwgYlszXSk7XG4gICAgcmV0dXJuIGE7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVOb2RlTWluWChhLCBiKSB7IHJldHVybiBhLmJib3hbMF0gLSBiLmJib3hbMF07IH1cbmZ1bmN0aW9uIGNvbXBhcmVOb2RlTWluWShhLCBiKSB7IHJldHVybiBhLmJib3hbMV0gLSBiLmJib3hbMV07IH1cblxuZnVuY3Rpb24gYmJveEFyZWEoYSkgICB7IHJldHVybiAoYVsyXSAtIGFbMF0pICogKGFbM10gLSBhWzFdKTsgfVxuZnVuY3Rpb24gYmJveE1hcmdpbihhKSB7IHJldHVybiAoYVsyXSAtIGFbMF0pICsgKGFbM10gLSBhWzFdKTsgfVxuXG5mdW5jdGlvbiBlbmxhcmdlZEFyZWEoYSwgYikge1xuICAgIHJldHVybiAoTWF0aC5tYXgoYlsyXSwgYVsyXSkgLSBNYXRoLm1pbihiWzBdLCBhWzBdKSkgKlxuICAgICAgICAgICAoTWF0aC5tYXgoYlszXSwgYVszXSkgLSBNYXRoLm1pbihiWzFdLCBhWzFdKSk7XG59XG5cbmZ1bmN0aW9uIGludGVyc2VjdGlvbkFyZWEoYSwgYikge1xuICAgIHZhciBtaW5YID0gTWF0aC5tYXgoYVswXSwgYlswXSksXG4gICAgICAgIG1pblkgPSBNYXRoLm1heChhWzFdLCBiWzFdKSxcbiAgICAgICAgbWF4WCA9IE1hdGgubWluKGFbMl0sIGJbMl0pLFxuICAgICAgICBtYXhZID0gTWF0aC5taW4oYVszXSwgYlszXSk7XG5cbiAgICByZXR1cm4gTWF0aC5tYXgoMCwgbWF4WCAtIG1pblgpICpcbiAgICAgICAgICAgTWF0aC5tYXgoMCwgbWF4WSAtIG1pblkpO1xufVxuXG5mdW5jdGlvbiBjb250YWlucyhhLCBiKSB7XG4gICAgcmV0dXJuIGFbMF0gPD0gYlswXSAmJlxuICAgICAgICAgICBhWzFdIDw9IGJbMV0gJiZcbiAgICAgICAgICAgYlsyXSA8PSBhWzJdICYmXG4gICAgICAgICAgIGJbM10gPD0gYVszXTtcbn1cblxuZnVuY3Rpb24gaW50ZXJzZWN0cyhhLCBiKSB7XG4gICAgcmV0dXJuIGJbMF0gPD0gYVsyXSAmJlxuICAgICAgICAgICBiWzFdIDw9IGFbM10gJiZcbiAgICAgICAgICAgYlsyXSA+PSBhWzBdICYmXG4gICAgICAgICAgIGJbM10gPj0gYVsxXTtcbn1cblxuLy8gc29ydCBhbiBhcnJheSBzbyB0aGF0IGl0ZW1zIGNvbWUgaW4gZ3JvdXBzIG9mIG4gdW5zb3J0ZWQgaXRlbXMsIHdpdGggZ3JvdXBzIHNvcnRlZCBiZXR3ZWVuIGVhY2ggb3RoZXI7XG4vLyBjb21iaW5lcyBzZWxlY3Rpb24gYWxnb3JpdGhtIHdpdGggYmluYXJ5IGRpdmlkZSAmIGNvbnF1ZXIgYXBwcm9hY2hcblxuZnVuY3Rpb24gbXVsdGlTZWxlY3QoYXJyLCBsZWZ0LCByaWdodCwgbiwgY29tcGFyZSkge1xuICAgIHZhciBzdGFjayA9IFtsZWZ0LCByaWdodF0sXG4gICAgICAgIG1pZDtcblxuICAgIHdoaWxlIChzdGFjay5sZW5ndGgpIHtcbiAgICAgICAgcmlnaHQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgbGVmdCA9IHN0YWNrLnBvcCgpO1xuXG4gICAgICAgIGlmIChyaWdodCAtIGxlZnQgPD0gbikgY29udGludWU7XG5cbiAgICAgICAgbWlkID0gbGVmdCArIE1hdGguY2VpbCgocmlnaHQgLSBsZWZ0KSAvIG4gLyAyKSAqIG47XG4gICAgICAgIHNlbGVjdChhcnIsIGxlZnQsIHJpZ2h0LCBtaWQsIGNvbXBhcmUpO1xuXG4gICAgICAgIHN0YWNrLnB1c2gobGVmdCwgbWlkLCBtaWQsIHJpZ2h0KTtcbiAgICB9XG59XG5cbi8vIEZsb3lkLVJpdmVzdCBzZWxlY3Rpb24gYWxnb3JpdGhtOlxuLy8gc29ydCBhbiBhcnJheSBiZXR3ZWVuIGxlZnQgYW5kIHJpZ2h0IChpbmNsdXNpdmUpIHNvIHRoYXQgdGhlIHNtYWxsZXN0IGsgZWxlbWVudHMgY29tZSBmaXJzdCAodW5vcmRlcmVkKVxuZnVuY3Rpb24gc2VsZWN0KGFyciwgbGVmdCwgcmlnaHQsIGssIGNvbXBhcmUpIHtcbiAgICB2YXIgbiwgaSwgeiwgcywgc2QsIG5ld0xlZnQsIG5ld1JpZ2h0LCB0LCBqO1xuXG4gICAgd2hpbGUgKHJpZ2h0ID4gbGVmdCkge1xuICAgICAgICBpZiAocmlnaHQgLSBsZWZ0ID4gNjAwKSB7XG4gICAgICAgICAgICBuID0gcmlnaHQgLSBsZWZ0ICsgMTtcbiAgICAgICAgICAgIGkgPSBrIC0gbGVmdCArIDE7XG4gICAgICAgICAgICB6ID0gTWF0aC5sb2cobik7XG4gICAgICAgICAgICBzID0gMC41ICogTWF0aC5leHAoMiAqIHogLyAzKTtcbiAgICAgICAgICAgIHNkID0gMC41ICogTWF0aC5zcXJ0KHogKiBzICogKG4gLSBzKSAvIG4pICogKGkgLSBuIC8gMiA8IDAgPyAtMSA6IDEpO1xuICAgICAgICAgICAgbmV3TGVmdCA9IE1hdGgubWF4KGxlZnQsIE1hdGguZmxvb3IoayAtIGkgKiBzIC8gbiArIHNkKSk7XG4gICAgICAgICAgICBuZXdSaWdodCA9IE1hdGgubWluKHJpZ2h0LCBNYXRoLmZsb29yKGsgKyAobiAtIGkpICogcyAvIG4gKyBzZCkpO1xuICAgICAgICAgICAgc2VsZWN0KGFyciwgbmV3TGVmdCwgbmV3UmlnaHQsIGssIGNvbXBhcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdCA9IGFycltrXTtcbiAgICAgICAgaSA9IGxlZnQ7XG4gICAgICAgIGogPSByaWdodDtcblxuICAgICAgICBzd2FwKGFyciwgbGVmdCwgayk7XG4gICAgICAgIGlmIChjb21wYXJlKGFycltyaWdodF0sIHQpID4gMCkgc3dhcChhcnIsIGxlZnQsIHJpZ2h0KTtcblxuICAgICAgICB3aGlsZSAoaSA8IGopIHtcbiAgICAgICAgICAgIHN3YXAoYXJyLCBpLCBqKTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGotLTtcbiAgICAgICAgICAgIHdoaWxlIChjb21wYXJlKGFycltpXSwgdCkgPCAwKSBpKys7XG4gICAgICAgICAgICB3aGlsZSAoY29tcGFyZShhcnJbal0sIHQpID4gMCkgai0tO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBhcmUoYXJyW2xlZnRdLCB0KSA9PT0gMCkgc3dhcChhcnIsIGxlZnQsIGopO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIHN3YXAoYXJyLCBqLCByaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaiA8PSBrKSBsZWZ0ID0gaiArIDE7XG4gICAgICAgIGlmIChrIDw9IGopIHJpZ2h0ID0gaiAtIDE7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzd2FwKGFyciwgaSwgaikge1xuICAgIHZhciB0bXAgPSBhcnJbaV07XG4gICAgYXJyW2ldID0gYXJyW2pdO1xuICAgIGFycltqXSA9IHRtcDtcbn1cblxuXG4vLyBleHBvcnQgYXMgQU1EL0NvbW1vbkpTIG1vZHVsZSBvciBnbG9iYWwgdmFyaWFibGVcbmlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIGRlZmluZSgncmJ1c2gnLCBmdW5jdGlvbigpIHsgcmV0dXJuIHJidXNoOyB9KTtcbmVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IHJidXNoO1xuZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSBzZWxmLnJidXNoID0gcmJ1c2g7XG5lbHNlIHdpbmRvdy5yYnVzaCA9IHJidXNoO1xuXG59KSgpO1xuIiwibW9kdWxlLmV4cG9ydHMuVmVjdG9yVGlsZSA9IHJlcXVpcmUoJy4vbGliL3ZlY3RvcnRpbGUuanMnKTtcbm1vZHVsZS5leHBvcnRzLlZlY3RvclRpbGVGZWF0dXJlID0gcmVxdWlyZSgnLi9saWIvdmVjdG9ydGlsZWZlYXR1cmUuanMnKTtcbm1vZHVsZS5leHBvcnRzLlZlY3RvclRpbGVMYXllciA9IHJlcXVpcmUoJy4vbGliL3ZlY3RvcnRpbGVsYXllci5qcycpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVmVjdG9yVGlsZUxheWVyID0gcmVxdWlyZSgnLi92ZWN0b3J0aWxlbGF5ZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3JUaWxlO1xuXG5mdW5jdGlvbiBWZWN0b3JUaWxlKGJ1ZmZlciwgZW5kKSB7XG5cbiAgICB0aGlzLmxheWVycyA9IHt9O1xuICAgIHRoaXMuX2J1ZmZlciA9IGJ1ZmZlcjtcblxuICAgIGVuZCA9IGVuZCB8fCBidWZmZXIubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGJ1ZmZlci5wb3MgPCBlbmQpIHtcbiAgICAgICAgdmFyIHZhbCA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgICAgICB0YWcgPSB2YWwgPj4gMztcblxuICAgICAgICBpZiAodGFnID09IDMpIHtcbiAgICAgICAgICAgIHZhciBsYXllciA9IHRoaXMucmVhZExheWVyKCk7XG4gICAgICAgICAgICBpZiAobGF5ZXIubGVuZ3RoKSB0aGlzLmxheWVyc1tsYXllci5uYW1lXSA9IGxheWVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnVmZmVyLnNraXAodmFsKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuVmVjdG9yVGlsZS5wcm90b3R5cGUucmVhZExheWVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcixcbiAgICAgICAgYnl0ZXMgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICBlbmQgPSBidWZmZXIucG9zICsgYnl0ZXMsXG4gICAgICAgIGxheWVyID0gbmV3IFZlY3RvclRpbGVMYXllcihidWZmZXIsIGVuZCk7XG5cbiAgICBidWZmZXIucG9zID0gZW5kO1xuXG4gICAgcmV0dXJuIGxheWVyO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFBvaW50ID0gcmVxdWlyZSgncG9pbnQtZ2VvbWV0cnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3JUaWxlRmVhdHVyZTtcblxuZnVuY3Rpb24gVmVjdG9yVGlsZUZlYXR1cmUoYnVmZmVyLCBlbmQsIGV4dGVudCwga2V5cywgdmFsdWVzKSB7XG5cbiAgICB0aGlzLnByb3BlcnRpZXMgPSB7fTtcblxuICAgIC8vIFB1YmxpY1xuICAgIHRoaXMuZXh0ZW50ID0gZXh0ZW50O1xuICAgIHRoaXMudHlwZSA9IDA7XG5cbiAgICAvLyBQcml2YXRlXG4gICAgdGhpcy5fYnVmZmVyID0gYnVmZmVyO1xuICAgIHRoaXMuX2dlb21ldHJ5ID0gLTE7XG5cbiAgICBlbmQgPSBlbmQgfHwgYnVmZmVyLmxlbmd0aDtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhciB2YWwgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICAgICAgdGFnID0gdmFsID4+IDM7XG5cbiAgICAgICAgaWYgKHRhZyA9PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9pZCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMikge1xuICAgICAgICAgICAgdmFyIHRhZ0xlbiA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgICAgICAgICAgdGFnRW5kID0gYnVmZmVyLnBvcyArIHRhZ0xlbjtcblxuICAgICAgICAgICAgd2hpbGUgKGJ1ZmZlci5wb3MgPCB0YWdFbmQpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tidWZmZXIucmVhZFZhcmludCgpXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSB2YWx1ZXNbYnVmZmVyLnJlYWRWYXJpbnQoKV07XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wZXJ0aWVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSAzKSB7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBidWZmZXIucmVhZFZhcmludCgpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDQpIHtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5ID0gYnVmZmVyLnBvcztcbiAgICAgICAgICAgIGJ1ZmZlci5za2lwKHZhbCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ1ZmZlci5za2lwKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblZlY3RvclRpbGVGZWF0dXJlLnR5cGVzID0gWydVbmtub3duJywgJ1BvaW50JywgJ0xpbmVTdHJpbmcnLCAnUG9seWdvbiddO1xuXG5WZWN0b3JUaWxlRmVhdHVyZS5wcm90b3R5cGUubG9hZEdlb21ldHJ5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcjtcbiAgICBidWZmZXIucG9zID0gdGhpcy5fZ2VvbWV0cnk7XG5cbiAgICB2YXIgYnl0ZXMgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICBlbmQgPSBidWZmZXIucG9zICsgYnl0ZXMsXG4gICAgICAgIGNtZCA9IDEsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIHggPSAwLFxuICAgICAgICB5ID0gMCxcbiAgICAgICAgbGluZXMgPSBbXSxcbiAgICAgICAgbGluZTtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIGlmICghbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgY21kX2xlbmd0aCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgICAgICBjbWQgPSBjbWRfbGVuZ3RoICYgMHg3O1xuICAgICAgICAgICAgbGVuZ3RoID0gY21kX2xlbmd0aCA+PiAzO1xuICAgICAgICB9XG5cbiAgICAgICAgbGVuZ3RoLS07XG5cbiAgICAgICAgaWYgKGNtZCA9PT0gMSB8fCBjbWQgPT09IDIpIHtcbiAgICAgICAgICAgIHggKz0gYnVmZmVyLnJlYWRTVmFyaW50KCk7XG4gICAgICAgICAgICB5ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuXG4gICAgICAgICAgICBpZiAoY21kID09PSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gbW92ZVRvXG4gICAgICAgICAgICAgICAgaWYgKGxpbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGluZSA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsaW5lLnB1c2gobmV3IFBvaW50KHgsIHkpKTtcbiAgICAgICAgfSBlbHNlIGlmIChjbWQgPT09IDcpIHtcbiAgICAgICAgICAgIC8vIGNsb3NlUG9seWdvblxuICAgICAgICAgICAgbGluZS5wdXNoKGxpbmVbMF0uY2xvbmUoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gY29tbWFuZCAnICsgY21kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsaW5lKSBsaW5lcy5wdXNoKGxpbmUpO1xuXG4gICAgcmV0dXJuIGxpbmVzO1xufTtcblxuVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLmJib3ggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5fYnVmZmVyO1xuICAgIGJ1ZmZlci5wb3MgPSB0aGlzLl9nZW9tZXRyeTtcblxuICAgIHZhciBieXRlcyA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgIGVuZCA9IGJ1ZmZlci5wb3MgKyBieXRlcyxcblxuICAgICAgICBjbWQgPSAxLFxuICAgICAgICBsZW5ndGggPSAwLFxuICAgICAgICB4ID0gMCxcbiAgICAgICAgeSA9IDAsXG4gICAgICAgIHgxID0gSW5maW5pdHksXG4gICAgICAgIHgyID0gLUluZmluaXR5LFxuICAgICAgICB5MSA9IEluZmluaXR5LFxuICAgICAgICB5MiA9IC1JbmZpbml0eTtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIGlmICghbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgY21kX2xlbmd0aCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgICAgICBjbWQgPSBjbWRfbGVuZ3RoICYgMHg3O1xuICAgICAgICAgICAgbGVuZ3RoID0gY21kX2xlbmd0aCA+PiAzO1xuICAgICAgICB9XG5cbiAgICAgICAgbGVuZ3RoLS07XG5cbiAgICAgICAgaWYgKGNtZCA9PT0gMSB8fCBjbWQgPT09IDIpIHtcbiAgICAgICAgICAgIHggKz0gYnVmZmVyLnJlYWRTVmFyaW50KCk7XG4gICAgICAgICAgICB5ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICAgICAgaWYgKHggPCB4MSkgeDEgPSB4O1xuICAgICAgICAgICAgaWYgKHggPiB4MikgeDIgPSB4O1xuICAgICAgICAgICAgaWYgKHkgPCB5MSkgeTEgPSB5O1xuICAgICAgICAgICAgaWYgKHkgPiB5MikgeTIgPSB5O1xuXG4gICAgICAgIH0gZWxzZSBpZiAoY21kICE9PSA3KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gY29tbWFuZCAnICsgY21kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBbeDEsIHkxLCB4MiwgeTJdO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFZlY3RvclRpbGVGZWF0dXJlID0gcmVxdWlyZSgnLi92ZWN0b3J0aWxlZmVhdHVyZS5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvclRpbGVMYXllcjtcbmZ1bmN0aW9uIFZlY3RvclRpbGVMYXllcihidWZmZXIsIGVuZCkge1xuICAgIC8vIFB1YmxpY1xuICAgIHRoaXMudmVyc2lvbiA9IDE7XG4gICAgdGhpcy5uYW1lID0gbnVsbDtcbiAgICB0aGlzLmV4dGVudCA9IDQwOTY7XG4gICAgdGhpcy5sZW5ndGggPSAwO1xuXG4gICAgLy8gUHJpdmF0ZVxuICAgIHRoaXMuX2J1ZmZlciA9IGJ1ZmZlcjtcbiAgICB0aGlzLl9rZXlzID0gW107XG4gICAgdGhpcy5fdmFsdWVzID0gW107XG4gICAgdGhpcy5fZmVhdHVyZXMgPSBbXTtcblxuICAgIHZhciB2YWwsIHRhZztcblxuICAgIGVuZCA9IGVuZCB8fCBidWZmZXIubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGJ1ZmZlci5wb3MgPCBlbmQpIHtcbiAgICAgICAgdmFsID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcbiAgICAgICAgdGFnID0gdmFsID4+IDM7XG5cbiAgICAgICAgaWYgKHRhZyA9PT0gMTUpIHtcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbiA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBidWZmZXIucmVhZFN0cmluZygpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gNSkge1xuICAgICAgICAgICAgdGhpcy5leHRlbnQgPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMikge1xuICAgICAgICAgICAgdGhpcy5sZW5ndGgrKztcbiAgICAgICAgICAgIHRoaXMuX2ZlYXR1cmVzLnB1c2goYnVmZmVyLnBvcyk7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09PSAzKSB7XG4gICAgICAgICAgICB0aGlzLl9rZXlzLnB1c2goYnVmZmVyLnJlYWRTdHJpbmcoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09PSA0KSB7XG4gICAgICAgICAgICB0aGlzLl92YWx1ZXMucHVzaCh0aGlzLnJlYWRGZWF0dXJlVmFsdWUoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5WZWN0b3JUaWxlTGF5ZXIucHJvdG90eXBlLnJlYWRGZWF0dXJlVmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5fYnVmZmVyLFxuICAgICAgICB2YWx1ZSA9IG51bGwsXG4gICAgICAgIGJ5dGVzID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgZW5kID0gYnVmZmVyLnBvcyArIGJ5dGVzLFxuICAgICAgICB2YWwsIHRhZztcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhbCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgIHRhZyA9IHZhbCA+PiAzO1xuXG4gICAgICAgIGlmICh0YWcgPT0gMSkge1xuICAgICAgICAgICAgdmFsdWUgPSBidWZmZXIucmVhZFN0cmluZygpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSAyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlYWQgZmxvYXQnKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMykge1xuICAgICAgICAgICAgdmFsdWUgPSBidWZmZXIucmVhZERvdWJsZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA0KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVhZCB1aW50Jyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDYpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYnVmZmVyLnJlYWRTVmFyaW50KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gQm9vbGVhbihidWZmZXIucmVhZFZhcmludCgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ1ZmZlci5za2lwKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyByZXR1cm4gZmVhdHVyZSBgaWAgZnJvbSB0aGlzIGxheWVyIGFzIGEgYFZlY3RvclRpbGVGZWF0dXJlYFxuVmVjdG9yVGlsZUxheWVyLnByb3RvdHlwZS5mZWF0dXJlID0gZnVuY3Rpb24oaSkge1xuICAgIGlmIChpIDwgMCB8fCBpID49IHRoaXMuX2ZlYXR1cmVzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdmZWF0dXJlIGluZGV4IG91dCBvZiBib3VuZHMnKTtcblxuICAgIHRoaXMuX2J1ZmZlci5wb3MgPSB0aGlzLl9mZWF0dXJlc1tpXTtcbiAgICB2YXIgZW5kID0gdGhpcy5fYnVmZmVyLnJlYWRWYXJpbnQoKSArIHRoaXMuX2J1ZmZlci5wb3M7XG5cbiAgICByZXR1cm4gbmV3IFZlY3RvclRpbGVGZWF0dXJlKHRoaXMuX2J1ZmZlciwgZW5kLCB0aGlzLmV4dGVudCwgdGhpcy5fa2V5cywgdGhpcy5fdmFsdWVzKTtcbn07XG4iLCIvKipcbiAqIENyZWF0ZWQgYnkgUnlhbiBXaGl0bGV5LCBEYW5pZWwgRHVhcnRlLCBhbmQgTmljaG9sYXMgSGFsbGFoYW5cbiAqICAgIG9uIDYvMDMvMTQuXG4gKi9cbnZhciBVdGlsID0gcmVxdWlyZSgnLi9NVlRVdGlsJyk7XG52YXIgU3RhdGljTGFiZWwgPSByZXF1aXJlKCcuL1N0YXRpY0xhYmVsL1N0YXRpY0xhYmVsLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTVZURmVhdHVyZTtcblxuZnVuY3Rpb24gTVZURmVhdHVyZShtdnRMYXllciwgdnRmLCBjdHgsIGlkLCBzdHlsZSkge1xuICBpZiAoIXZ0ZikgcmV0dXJuIG51bGw7XG5cbiAgLy8gQXBwbHkgYWxsIG9mIHRoZSBwcm9wZXJ0aWVzIG9mIHZ0ZiB0byB0aGlzIG9iamVjdC5cbiAgZm9yICh2YXIga2V5IGluIHZ0Zikge1xuICAgIC8vIElnbm9yZSBwcml2YXRlIGZpZWxkcy5cbiAgICBpZiAoa2V5LmNoYXJBdCgwKSAhPT0gJ18nKSB7XG4gICAgICB0aGlzW2tleV0gPSB2dGZba2V5XTtcbiAgICB9XG4gIH1cblxuICB0aGlzLm12dExheWVyID0gbXZ0TGF5ZXI7XG4gIHRoaXMubXZ0U291cmNlID0gbXZ0TGF5ZXIubXZ0U291cmNlO1xuICB0aGlzLm1hcCA9IG12dExheWVyLm12dFNvdXJjZS5tYXA7XG5cbiAgdGhpcy5pZCA9IGlkO1xuXG4gIHRoaXMubGF5ZXJMaW5rID0gdGhpcy5tdnRTb3VyY2UubGF5ZXJMaW5rO1xuICB0aGlzLnRvZ2dsZUVuYWJsZWQgPSB0cnVlO1xuICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG5cbiAgLy8gaG93IG11Y2ggd2UgZGl2aWRlIHRoZSBjb29yZGluYXRlIGZyb20gdGhlIHZlY3RvciB0aWxlXG4gIHRoaXMuZGl2aXNvciA9IHZ0Zi5leHRlbnQgLyBjdHgudGlsZVNpemU7XG4gIHRoaXMuZXh0ZW50ID0gdnRmLmV4dGVudDtcbiAgdGhpcy50aWxlU2l6ZSA9IGN0eC50aWxlU2l6ZTtcblxuICAvL0FuIG9iamVjdCB0byBzdG9yZSB0aGUgcGF0aHMgYW5kIGNvbnRleHRzIGZvciB0aGlzIGZlYXR1cmVcbiAgdGhpcy50aWxlcyA9IHt9O1xuXG4gIC8vIFRPRE86IHRoaW5rIGFib3V0IHRoaXMgZGVzaWduXG4gIHRoaXMubXZ0TGF5ZXIuaW1nQ2FjaGUgPSB0aGlzLm12dExheWVyLmltZ0NhY2hlIHx8IHt9O1xuXG4gIHRoaXMuc3R5bGUgPSBzdHlsZTtcblxuICAvL0FkZCB0byB0aGUgY29sbGVjdGlvblxuICB0aGlzLmFkZFRpbGVGZWF0dXJlKHZ0ZiwgY3R4KTtcblxuICB0aGlzLm1hcC5vbignem9vbWVuZCcsIHRoaXMuX3pvb21lbmQsIHRoaXMpO1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG12dExheWVyLm9uKCdyZW1vdmUnLCBmdW5jdGlvbigpIHtcbiAgICBzZWxmLm1hcC5vZmYoJ3pvb21lbmQnLCBzZWxmLl96b29tZW5kLCBzZWxmKTtcbiAgfSk7XG5cbiAgaWYgKHN0eWxlICYmIHN0eWxlLmR5bmFtaWNMYWJlbCAmJiB0eXBlb2Ygc3R5bGUuZHluYW1pY0xhYmVsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5keW5hbWljTGFiZWwgPSB0aGlzLm12dFNvdXJjZS5keW5hbWljTGFiZWwuY3JlYXRlRmVhdHVyZSh0aGlzKTtcbiAgfVxuXG4gIGFqYXgodGhpcyk7XG59XG5cblxuZnVuY3Rpb24gYWpheChzZWxmKSB7XG4gIHZhciBzdHlsZSA9IHNlbGYuc3R5bGU7XG4gIGlmIChzdHlsZSAmJiBzdHlsZS5hamF4U291cmNlICYmIHR5cGVvZiBzdHlsZS5hamF4U291cmNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGFqYXhFbmRwb2ludCA9IHN0eWxlLmFqYXhTb3VyY2Uoc2VsZik7XG4gICAgaWYgKGFqYXhFbmRwb2ludCkge1xuICAgICAgVXRpbC5nZXRKU09OKGFqYXhFbmRwb2ludCwgZnVuY3Rpb24oZXJyb3IsIHJlc3BvbnNlLCBib2R5KSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHRocm93IFsnYWpheFNvdXJjZSBBSkFYIEVycm9yJywgZXJyb3JdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFqYXhDYWxsYmFjayhzZWxmLCByZXNwb25zZSk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFqYXhDYWxsYmFjayhzZWxmLCByZXNwb25zZSkge1xuICBzZWxmLmFqYXhEYXRhID0gcmVzcG9uc2U7XG5cbiAgLyoqXG4gICAqIFlvdSBjYW4gYXR0YWNoIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gYSBmZWF0dXJlIGluIHlvdXIgYXBwXG4gICAqIHRoYXQgd2lsbCBnZXQgY2FsbGVkIHdoZW5ldmVyIG5ldyBhamF4RGF0YSBjb21lcyBpbi4gVGhpc1xuICAgKiBjYW4gYmUgdXNlZCB0byB1cGRhdGUgVUkgdGhhdCBsb29rcyBhdCBkYXRhIGZyb20gd2l0aGluIGEgZmVhdHVyZS5cbiAgICpcbiAgICogc2V0U3R5bGUgbWF5IHBvc3NpYmx5IGhhdmUgYSBzdHlsZSB3aXRoIGEgZGlmZmVyZW50IGFqYXhEYXRhIHNvdXJjZSxcbiAgICogYW5kIHlvdSB3b3VsZCBwb3RlbnRpYWxseSBnZXQgbmV3IGNvbnRleHR1YWwgZGF0YSBmb3IgeW91ciBmZWF0dXJlLlxuICAgKlxuICAgKiBUT0RPOiBUaGlzIG5lZWRzIHRvIGJlIGRvY3VtZW50ZWQuXG4gICAqL1xuICBpZiAodHlwZW9mIHNlbGYuYWpheERhdGFSZWNlaXZlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHNlbGYuYWpheERhdGFSZWNlaXZlZChzZWxmLCByZXNwb25zZSk7XG4gIH1cblxuICBzZWxmLl9zZXRTdHlsZShzZWxmLm12dExheWVyLnN0eWxlKTtcbiAgdGhpcy5yZWRyYXcoKTtcbn1cblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX3NldFN0eWxlID0gZnVuY3Rpb24oc3R5bGVGbikge1xuICB0aGlzLnN0eWxlID0gc3R5bGVGbih0aGlzLCB0aGlzLmFqYXhEYXRhKTtcblxuICAvLyBUaGUgbGFiZWwgZ2V0cyByZW1vdmVkLCBhbmQgdGhlIChyZSlkcmF3LFxuICAvLyB0aGF0IGlzIGluaXRpYXRlZCBieSB0aGUgTVZUTGF5ZXIgY3JlYXRlcyBhIG5ldyBsYWJlbC5cbiAgdGhpcy5yZW1vdmVMYWJlbCgpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuc2V0U3R5bGUgPSBmdW5jdGlvbihzdHlsZUZuKSB7XG4gIHRoaXMuYWpheERhdGEgPSBudWxsO1xuICB0aGlzLnN0eWxlID0gc3R5bGVGbih0aGlzLCBudWxsKTtcbiAgdmFyIGhhc0FqYXhTb3VyY2UgPSBhamF4KHRoaXMpO1xuICBpZiAoIWhhc0FqYXhTb3VyY2UpIHtcbiAgICAvLyBUaGUgbGFiZWwgZ2V0cyByZW1vdmVkLCBhbmQgdGhlIChyZSlkcmF3LFxuICAgIC8vIHRoYXQgaXMgaW5pdGlhdGVkIGJ5IHRoZSBNVlRMYXllciBjcmVhdGVzIGEgbmV3IGxhYmVsLlxuICAgIHRoaXMucmVtb3ZlTGFiZWwoKTtcbiAgfVxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKGNhbnZhc0lEKSB7XG4gIC8vR2V0IHRoZSBpbmZvIGZyb20gdGhlIHRpbGVzIGxpc3RcbiAgdmFyIHRpbGVJbmZvID0gIHRoaXMudGlsZXNbY2FudmFzSURdO1xuXG4gIHZhciB2dGYgPSB0aWxlSW5mby52dGY7XG4gIHZhciBjdHggPSB0aWxlSW5mby5jdHg7XG5cbiAgLy9HZXQgdGhlIGFjdHVhbCBjYW52YXMgZnJvbSB0aGUgcGFyZW50IGxheWVyJ3MgX3RpbGVzIG9iamVjdC5cbiAgdmFyIHh5ID0gY2FudmFzSUQuc3BsaXQoXCI6XCIpLnNsaWNlKDEsIDMpLmpvaW4oXCI6XCIpO1xuICBjdHguY2FudmFzID0gdGhpcy5tdnRMYXllci5fdGlsZXNbeHldO1xuXG4vLyAgVGhpcyBjb3VsZCBiZSB1c2VkIHRvIGRpcmVjdGx5IGNvbXB1dGUgdGhlIHN0eWxlIGZ1bmN0aW9uIGZyb20gdGhlIGxheWVyIG9uIGV2ZXJ5IGRyYXcuXG4vLyAgVGhpcyBpcyBtdWNoIGxlc3MgZWZmaWNpZW50Li4uXG4vLyAgdGhpcy5zdHlsZSA9IHRoaXMubXZ0TGF5ZXIuc3R5bGUodGhpcyk7XG5cbiAgaWYgKHRoaXMuc2VsZWN0ZWQpIHtcbiAgICB2YXIgc3R5bGUgPSB0aGlzLnN0eWxlLnNlbGVjdGVkIHx8IHRoaXMuc3R5bGU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHN0eWxlID0gdGhpcy5zdHlsZTtcbiAgfVxuXG4gIHN3aXRjaCAodnRmLnR5cGUpIHtcbiAgICBjYXNlIDE6IC8vUG9pbnRcbiAgICAgIHRoaXMuX2RyYXdQb2ludChjdHgsIHZ0Zi5jb29yZGluYXRlcywgc3R5bGUpO1xuICAgICAgaWYgKCF0aGlzLnN0YXRpY0xhYmVsICYmIHR5cGVvZiB0aGlzLnN0eWxlLnN0YXRpY0xhYmVsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGlmICh0aGlzLnN0eWxlLmFqYXhTb3VyY2UgJiYgIXRoaXMuYWpheERhdGEpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kcmF3U3RhdGljTGFiZWwoY3R4LCB2dGYuY29vcmRpbmF0ZXMsIHN0eWxlKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAyOiAvL0xpbmVTdHJpbmdcbiAgICAgIHRoaXMuX2RyYXdMaW5lU3RyaW5nKGN0eCwgdnRmLmNvb3JkaW5hdGVzLCBzdHlsZSk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgMzogLy9Qb2x5Z29uXG4gICAgICB0aGlzLl9kcmF3UG9seWdvbihjdHgsIHZ0Zi5jb29yZGluYXRlcywgc3R5bGUpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbm1hbmFnZWQgdHlwZTogJyArIHZ0Zi50eXBlKTtcbiAgfVxuXG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5nZXRQYXRoc0ZvclRpbGUgPSBmdW5jdGlvbihjYW52YXNJRCkge1xuICB2YXIgdGlsZSA9IHRoaXMudGlsZXNbY2FudmFzSURdO1xuICBpZiAodGlsZSkge1xuICAgIHJldHVybiB0aWxlLnBhdGhzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBbXTtcbiAgfVxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuYWRkVGlsZUZlYXR1cmUgPSBmdW5jdGlvbih2dGYsIGN0eCkge1xuICAvL1N0b3JlIHRoZSBpbXBvcnRhbnQgaXRlbXMgaW4gdGhlIHRpbGVzIGxpc3RcblxuICAvL1dlIG9ubHkgd2FudCB0byBzdG9yZSBpbmZvIGZvciB0aWxlcyBmb3IgdGhlIGN1cnJlbnQgbWFwIHpvb20uICBJZiBpdCBpcyB0aWxlIGluZm8gZm9yIGFub3RoZXIgem9vbSBsZXZlbCwgaWdub3JlIGl0XG4gIC8vQWxzbywgaWYgdGhlcmUgYXJlIGV4aXN0aW5nIHRpbGVzIGluIHRoZSBsaXN0IGZvciBvdGhlciB6b29tIGxldmVscywgZXhwdW5nZSB0aGVtLlxuICB2YXIgem9vbSA9IHRoaXMubWFwLmdldFpvb20oKTtcblxuICBpZihjdHguem9vbSAhPSB6b29tKSByZXR1cm47XG5cbiAgdGhpcy50aWxlc1tjdHguaWRdID0ge1xuICAgIGN0eDogY3R4LFxuICAgIHZ0ZjogdnRmLFxuICAgIHBhdGhzOiBbXVxuICB9O1xuXG59O1xuXG5cbi8qKlxuICogQ2xlYXIgdGhlIGlubmVyIGxpc3Qgb2YgdGlsZSBmZWF0dXJlcyBpZiB0aGV5IGRvbid0IG1hdGNoIHRoZSBnaXZlbiB6b29tLlxuICpcbiAqIEBwYXJhbSB6b29tXG4gKi9cbk1WVEZlYXR1cmUucHJvdG90eXBlLmNsZWFyVGlsZUZlYXR1cmVzID0gZnVuY3Rpb24oem9vbSkge1xuICAvL0lmIHN0b3JlZCB0aWxlcyBleGlzdCBmb3Igb3RoZXIgem9vbSBsZXZlbHMsIGV4cHVuZ2UgdGhlbSBmcm9tIHRoZSBsaXN0LlxuICBmb3IgKHZhciBrZXkgaW4gdGhpcy50aWxlcykge1xuICAgICBpZihrZXkuc3BsaXQoXCI6XCIpWzBdICE9IHpvb20pIGRlbGV0ZSB0aGlzLnRpbGVzW2tleV07XG4gIH1cbn07XG5cbi8qKlxuICogUmVkcmF3cyBhbGwgb2YgdGhlIHRpbGVzIGFzc29jaWF0ZWQgd2l0aCBhIGZlYXR1cmUuIFVzZWZ1bCBmb3JcbiAqIHN0eWxlIGNoYW5nZSBhbmQgdG9nZ2xpbmcuXG4gKi9cbk1WVEZlYXR1cmUucHJvdG90eXBlLnJlZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAvL1JlZHJhdyB0aGUgd2hvbGUgdGlsZSwgbm90IGp1c3QgdGhpcyB2dGZcbiAgZm9yICh2YXIgaWQgaW4gdGhpcy50aWxlcykge1xuICAgIHZhciB0aWxlWm9vbSA9IHBhcnNlSW50KGlkLnNwbGl0KCc6JylbMF0pO1xuICAgIHZhciBtYXBab29tID0gdGhpcy5tYXAuZ2V0Wm9vbSgpO1xuICAgIGlmICh0aWxlWm9vbSA9PT0gbWFwWm9vbSkge1xuICAgICAgLy9SZWRyYXcgdGhlIHRpbGVcbiAgICAgIHRoaXMubXZ0TGF5ZXIucmVkcmF3VGlsZShpZCk7XG4gICAgfVxuICB9XG59XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5zZWxlY3RlZCkge1xuICAgIHRoaXMuZGVzZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNlbGVjdCgpO1xuICB9XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5zZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IHRydWU7XG4gIHRoaXMubXZ0U291cmNlLmZlYXR1cmVTZWxlY3RlZCh0aGlzKTtcbiAgdGhpcy5yZWRyYXcoKTtcbiAgdmFyIGxpbmtlZEZlYXR1cmUgPSB0aGlzLmxpbmtlZEZlYXR1cmUoKTtcbiAgaWYgKGxpbmtlZEZlYXR1cmUgJiYgbGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbCAmJiAhbGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbC5zZWxlY3RlZCkge1xuICAgIGxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwuc2VsZWN0KCk7XG4gIH1cbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLmRlc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgdGhpcy5tdnRTb3VyY2UuZmVhdHVyZURlc2VsZWN0ZWQodGhpcyk7XG4gIHRoaXMucmVkcmF3KCk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gdGhpcy5saW5rZWRGZWF0dXJlKCk7XG4gIGlmIChsaW5rZWRGZWF0dXJlICYmIGxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwgJiYgbGlua2VkRmVhdHVyZS5zdGF0aWNMYWJlbC5zZWxlY3RlZCkge1xuICAgIGxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwuZGVzZWxlY3QoKTtcbiAgfVxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudFR5cGUsIGNhbGxiYWNrKSB7XG4gIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRUeXBlXSA9IGNhbGxiYWNrO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdQb2ludCA9IGZ1bmN0aW9uKGN0eCwgY29vcmRzQXJyYXksIHN0eWxlKSB7XG4gIGlmICghc3R5bGUpIHJldHVybjtcbiAgaWYgKCFjdHggfHwgIWN0eC5jYW52YXMpIHJldHVybjtcblxuICB2YXIgdGlsZSA9IHRoaXMudGlsZXNbY3R4LmlkXTtcblxuICB2YXIgcCA9IHRoaXMuX3RpbGVQb2ludChjb29yZHNBcnJheVswXVswXSk7XG4gIHZhciBjID0gY3R4LmNhbnZhcztcbiAgdmFyIGN0eDJkO1xuXG4gIHRyeSB7XG4gICAgY3R4MmQgPSBjLmdldENvbnRleHQoJzJkJyk7XG4gIH1cbiAgY2F0Y2goZSkge1xuICAgIGNvbnNvbGUubG9nKFwiX2RyYXdQb2ludCBlcnJvcjogXCIgKyBlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBTYXZlIGFuZCByZW5kZXIgZmVhdHVyZSB3LyBzcGVjaWZpZWQgYWxwaGFcbiAgdmFyIHByZUFscGhhID0gY3R4MmQuZ2xvYmFsQWxwaGE7XG4gIGN0eDJkLmdsb2JhbEFscGhhID0gc3R5bGUub3BhY2l0eSB8fCBwcmVBbHBoYTtcblxuICBpZiAoJ2ljb25VcmwnIGluIHN0eWxlKXtcbiAgICB0aGlzLl9kcmF3UG9pbnRJY29uKGN0eCwgY3R4MmQsIHAsIHN0eWxlKTsgXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fZHJhd1BvaW50Q2lyY2xlKGN0eCwgY3R4MmQsIHAsIHN0eWxlKTtcbiAgfVxuXG4gIGN0eDJkLmdsb2JhbEFscGhhID0gcHJlQWxwaGE7XG4gIHRpbGUucGF0aHMucHVzaChbcF0pO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdQb2ludENpcmNsZSA9IGZ1bmN0aW9uKGN0eCwgY3R4MmQsIHAsIHN0eWxlKSB7XG4gICBcblxuICAvL0dldCByYWRpdXNcbiAgdmFyIHJhZGl1cyA9IDE7XG4gIGlmICh0eXBlb2Ygc3R5bGUucmFkaXVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmFkaXVzID0gc3R5bGUucmFkaXVzKGN0eC56b29tKTsgLy9BbGxvd3MgZm9yIHNjYWxlIGRlcGVuZGVudCByZWRuZXJpbmdcbiAgfVxuICBlbHNle1xuICAgIHJhZGl1cyA9IHN0eWxlLnJhZGl1cztcbiAgfVxuXG4gIGN0eDJkLmJlZ2luUGF0aCgpO1xuICBjdHgyZC5maWxsU3R5bGUgPSBzdHlsZS5jb2xvcjtcbiAgY3R4MmQuYXJjKHAueCwgcC55LCByYWRpdXMsIDAsIE1hdGguUEkgKiAyKTtcbiAgY3R4MmQuY2xvc2VQYXRoKCk7XG4gIGN0eDJkLmZpbGwoKTtcblxuICBpZihzdHlsZS5saW5lV2lkdGggJiYgc3R5bGUuc3Ryb2tlU3R5bGUpe1xuICAgIGN0eDJkLmxpbmVXaWR0aCA9IHN0eWxlLmxpbmVXaWR0aDtcbiAgICBjdHgyZC5zdHJva2VTdHlsZSA9IHN0eWxlLnN0cm9rZVN0eWxlO1xuICAgIGN0eDJkLnN0cm9rZSgpO1xuICB9XG5cbiAgY3R4MmQucmVzdG9yZSgpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdQb2ludEljb24gPSBmdW5jdGlvbihjdHgsIGN0eDJkLCBwLCBzdHlsZSl7XG5cbiAgICB2YXIgdXJsID0gc3R5bGUuaWNvblVybDtcbiAgICB2YXIgaW1nO1xuICAgIGlmICghKHVybCBpbiB0aGlzLm12dExheWVyLmltZ0NhY2hlKSl7XG4gICAgICAgIGltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBpbWcuc3JjID0gdXJsO1xuICAgICAgICB0aGlzLm12dExheWVyLmltZ0NhY2hlW3VybF0gPSBpbWc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW1nID0gdGhpcy5tdnRMYXllci5pbWdDYWNoZVt1cmxdO1xuICAgIH1cblxuICAgIC8vR2V0IHJhZGl1c1xuICAgIHZhciByYWRpdXMgPSAxO1xuICAgIGlmICh0eXBlb2Ygc3R5bGUucmFkaXVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByYWRpdXMgPSBzdHlsZS5yYWRpdXMoY3R4Lnpvb20pOyAvL0FsbG93cyBmb3Igc2NhbGUgZGVwZW5kZW50IHJlZG5lcmluZ1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJhZGl1cyA9IHN0eWxlLnJhZGl1cztcbiAgICB9XG5cbiAgICBpZiAoaW1nLmNvbXBsZXRlKXtcbiAgICAgICAgY3R4MmQuZHJhd0ltYWdlKGltZywgcC54IC0gcmFkaXVzLCBwLnkgLSByYWRpdXMsIHJhZGl1cyoyLCByYWRpdXMqMik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgKGZ1bmN0aW9uKHgseSl7XG4gICAgICAgICAgICAkKGltZykubG9hZChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIGN0eDJkLmRyYXdJbWFnZSh0aGlzLCB4IC0gcmFkaXVzLCB5IC0gcmFkaXVzLCByYWRpdXMqMiwgcmFkaXVzKjIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKHAueCwgcC55KTtcbiAgICB9XG59XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9kcmF3TGluZVN0cmluZyA9IGZ1bmN0aW9uKGN0eCwgY29vcmRzQXJyYXksIHN0eWxlKSB7XG4gIGlmICghc3R5bGUpIHJldHVybjtcbiAgaWYgKCFjdHggfHwgIWN0eC5jYW52YXMpIHJldHVybjtcblxuICAvLyBTYXZlIGFuZCByZW5kZXIgZmVhdHVyZSB3LyBzcGVjaWZpZWQgYWxwaGFcbiAgdmFyIHByZUFscGhhID0gY3R4MmQuZ2xvYmFsQWxwaGE7XG4gIGN0eDJkLmdsb2JhbEFscGhhID0gc3R5bGUub3BhY2l0eSB8fCBwcmVBbHBoYTtcblxuICB2YXIgY3R4MmQgPSBjdHguY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gIGN0eDJkLnN0cm9rZVN0eWxlID0gc3R5bGUuY29sb3I7XG4gIGN0eDJkLmxpbmVXaWR0aCA9IHN0eWxlLnNpemU7XG4gIGN0eDJkLmJlZ2luUGF0aCgpO1xuXG4gIHZhciBwcm9qQ29vcmRzID0gW107XG4gIHZhciB0aWxlID0gdGhpcy50aWxlc1tjdHguaWRdO1xuXG4gIGZvciAodmFyIGdpZHggaW4gY29vcmRzQXJyYXkpIHtcbiAgICB2YXIgY29vcmRzID0gY29vcmRzQXJyYXlbZ2lkeF07XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbWV0aG9kID0gKGkgPT09IDAgPyAnbW92ZScgOiAnbGluZScpICsgJ1RvJztcbiAgICAgIHZhciBwcm9qID0gdGhpcy5fdGlsZVBvaW50KGNvb3Jkc1tpXSk7XG4gICAgICBwcm9qQ29vcmRzLnB1c2gocHJvaik7XG4gICAgICBjdHgyZFttZXRob2RdKHByb2oueCwgcHJvai55KTtcbiAgICB9XG4gIH1cblxuICBjdHgyZC5zdHJva2UoKTtcbiAgY3R4MmQucmVzdG9yZSgpO1xuICBjdHgyZC5nbG9iYWxBbHBoYSA9IHByZUFscGhhO1xuXG4gIHRpbGUucGF0aHMucHVzaChwcm9qQ29vcmRzKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9kcmF3UG9seWdvbiA9IGZ1bmN0aW9uKGN0eCwgY29vcmRzQXJyYXksIHN0eWxlKSB7XG4gIGlmICghc3R5bGUpIHJldHVybjtcbiAgaWYgKCFjdHggfHwgIWN0eC5jYW52YXMpIHJldHVybjtcbiAgY29uc29sZS5sb2coXCJNVlRGZWF0dXJlOiBzdHlsZSBpcyBcIiArIEpTT04uc3RyaW5naWZ5KHN0eWxlKSk7XG5cbiAgdmFyIGN0eDJkID0gY3R4LmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gIC8vIFNhdmUgYW5kIHJlbmRlciBmZWF0dXJlIHcvIHNwZWNpZmllZCBhbHBoYVxuICB2YXIgcHJlQWxwaGEgPSBjdHgyZC5nbG9iYWxBbHBoYTtcbiAgY3R4MmQuZ2xvYmFsQWxwaGEgPSBzdHlsZS5vcGFjaXR5IHx8IHByZUFscGhhO1xuXG4gIHZhciBvdXRsaW5lID0gc3R5bGUub3V0bGluZTtcblxuICAvLyBjb2xvciBtYXkgYmUgZGVmaW5lZCB2aWEgZnVuY3Rpb24gdG8gbWFrZSBjaG9yb3BsZXRoIHdvcmsgcmlnaHRcbiAgaWYgKHR5cGVvZiBzdHlsZS5jb2xvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGN0eDJkLmZpbGxTdHlsZSA9IHN0eWxlLmNvbG9yKGN0eDJkKTtcbiAgfSBlbHNlIHtcbiAgICBjdHgyZC5maWxsU3R5bGUgPSBzdHlsZS5jb2xvcjtcbiAgfVxuXG4gIGlmIChvdXRsaW5lKSB7XG4gICAgY3R4MmQuc3Ryb2tlU3R5bGUgPSBvdXRsaW5lLmNvbG9yO1xuICAgIGN0eDJkLmxpbmVXaWR0aCA9IG91dGxpbmUuc2l6ZTtcbiAgfVxuICBjdHgyZC5iZWdpblBhdGgoKTtcblxuICB2YXIgcHJvakNvb3JkcyA9IFtdO1xuICB2YXIgdGlsZSA9IHRoaXMudGlsZXNbY3R4LmlkXTtcblxuICB2YXIgZmVhdHVyZUxhYmVsID0gdGhpcy5keW5hbWljTGFiZWw7XG4gIGlmIChmZWF0dXJlTGFiZWwpIHtcbiAgICBmZWF0dXJlTGFiZWwuYWRkVGlsZVBvbHlzKGN0eCwgY29vcmRzQXJyYXkpO1xuICB9XG5cbiAgZm9yICh2YXIgZ2lkeCA9IDAsIGxlbiA9IGNvb3Jkc0FycmF5Lmxlbmd0aDsgZ2lkeCA8IGxlbjsgZ2lkeCsrKSB7XG4gICAgdmFyIGNvb3JkcyA9IGNvb3Jkc0FycmF5W2dpZHhdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjb29yZCA9IGNvb3Jkc1tpXTtcbiAgICAgIHZhciBtZXRob2QgPSAoaSA9PT0gMCA/ICdtb3ZlJyA6ICdsaW5lJykgKyAnVG8nO1xuICAgICAgdmFyIHByb2ogPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzW2ldKTtcbiAgICAgIHByb2pDb29yZHMucHVzaChwcm9qKTtcbiAgICAgIGN0eDJkW21ldGhvZF0ocHJvai54LCBwcm9qLnkpO1xuICAgIH1cbiAgfVxuXG4gIGN0eDJkLmNsb3NlUGF0aCgpO1xuICBjdHgyZC5maWxsKCk7XG4gIGlmIChvdXRsaW5lKSB7XG4gICAgY3R4MmQuc3Ryb2tlKCk7XG4gIH1cbiAgLy8gUmVzdG9yZSBhbHBoYVxuICBjdHgyZC5nbG9iYWxBbHBoYSA9IHByZUFscGhhO1xuXG4gIHRpbGUucGF0aHMucHVzaChwcm9qQ29vcmRzKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9kcmF3U3RhdGljTGFiZWwgPSBmdW5jdGlvbihjdHgsIGNvb3Jkc0FycmF5LCBzdHlsZSkge1xuICBpZiAoIXN0eWxlKSByZXR1cm47XG4gIGlmICghY3R4KSByZXR1cm47XG5cbiAgLy8gSWYgdGhlIGNvcnJlc3BvbmRpbmcgbGF5ZXIgaXMgbm90IG9uIHRoZSBtYXAsIFxuICAvLyB3ZSBkb250IHdhbnQgdG8gcHV0IG9uIGEgbGFiZWwuXG4gIGlmICghdGhpcy5tdnRMYXllci5fbWFwKSByZXR1cm47XG5cbiAgdmFyIHZlY1B0ID0gdGhpcy5fdGlsZVBvaW50KGNvb3Jkc0FycmF5WzBdWzBdKTtcblxuICAvLyBXZSdyZSBtYWtpbmcgYSBzdGFuZGFyZCBMZWFmbGV0IE1hcmtlciBmb3IgdGhpcyBsYWJlbC5cbiAgdmFyIHAgPSB0aGlzLl9wcm9qZWN0KHZlY1B0LCBjdHgudGlsZS54LCBjdHgudGlsZS55LCB0aGlzLmV4dGVudCwgdGhpcy50aWxlU2l6ZSk7IC8vdmVjdGlsZSBwdCB0byBtZXJjIHB0XG4gIHZhciBtZXJjUHQgPSBMLnBvaW50KHAueCwgcC55KTsgLy8gbWFrZSBpbnRvIGxlYWZsZXQgb2JqXG4gIHZhciBsYXRMbmcgPSB0aGlzLm1hcC51bnByb2plY3QobWVyY1B0KTsgLy8gbWVyYyBwdCB0byBsYXRsbmdcblxuICB0aGlzLnN0YXRpY0xhYmVsID0gbmV3IFN0YXRpY0xhYmVsKHRoaXMsIGN0eCwgbGF0TG5nLCBzdHlsZSk7XG4gIHRoaXMubXZ0TGF5ZXIuZmVhdHVyZVdpdGhMYWJlbEFkZGVkKHRoaXMpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUucmVtb3ZlTGFiZWwgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLnN0YXRpY0xhYmVsKSByZXR1cm47XG4gIHRoaXMuc3RhdGljTGFiZWwucmVtb3ZlKCk7XG4gIHRoaXMuc3RhdGljTGFiZWwgPSBudWxsO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX3pvb21lbmQgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5yZW1vdmVMYWJlbCgpO1xuICB0aGlzLmNsZWFyVGlsZUZlYXR1cmVzKHRoaXMubWFwLmdldFpvb20oKSk7XG59O1xuXG4vKipcbiAqIFByb2plY3RzIGEgdmVjdG9yIHRpbGUgcG9pbnQgdG8gdGhlIFNwaGVyaWNhbCBNZXJjYXRvciBwaXhlbCBzcGFjZSBmb3IgYSBnaXZlbiB6b29tIGxldmVsLlxuICpcbiAqIEBwYXJhbSB2ZWNQdFxuICogQHBhcmFtIHRpbGVYXG4gKiBAcGFyYW0gdGlsZVlcbiAqIEBwYXJhbSBleHRlbnRcbiAqIEBwYXJhbSB0aWxlU2l6ZVxuICovXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fcHJvamVjdCA9IGZ1bmN0aW9uKHZlY1B0LCB0aWxlWCwgdGlsZVksIGV4dGVudCwgdGlsZVNpemUpIHtcbiAgdmFyIHhPZmZzZXQgPSB0aWxlWCAqIHRpbGVTaXplO1xuICB2YXIgeU9mZnNldCA9IHRpbGVZICogdGlsZVNpemU7XG4gIHJldHVybiB7XG4gICAgeDogTWF0aC5mbG9vcih2ZWNQdC54ICsgeE9mZnNldCksXG4gICAgeTogTWF0aC5mbG9vcih2ZWNQdC55ICsgeU9mZnNldClcbiAgfTtcbn07XG5cbi8qKlxuICogVGFrZXMgYSBjb29yZGluYXRlIGZyb20gYSB2ZWN0b3IgdGlsZSBhbmQgdHVybnMgaXQgaW50byBhIExlYWZsZXQgUG9pbnQuXG4gKlxuICogQHBhcmFtIGN0eFxuICogQHBhcmFtIGNvb3Jkc1xuICogQHJldHVybnMge2VHZW9tVHlwZS5Qb2ludH1cbiAqIEBwcml2YXRlXG4gKi9cbk1WVEZlYXR1cmUucHJvdG90eXBlLl90aWxlUG9pbnQgPSBmdW5jdGlvbihjb29yZHMpIHtcbiAgcmV0dXJuIG5ldyBMLlBvaW50KGNvb3Jkcy54IC8gdGhpcy5kaXZpc29yLCBjb29yZHMueSAvIHRoaXMuZGl2aXNvcik7XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5saW5rZWRGZWF0dXJlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBsaW5rZWRMYXllciA9IHRoaXMubXZ0TGF5ZXIubGlua2VkTGF5ZXIoKTtcbiAgaWYobGlua2VkTGF5ZXIpe1xuICAgIHZhciBsaW5rZWRGZWF0dXJlID0gbGlua2VkTGF5ZXIuZmVhdHVyZXNbdGhpcy5pZF07XG4gICAgcmV0dXJuIGxpbmtlZEZlYXR1cmU7XG4gIH1lbHNle1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG4iLCIvKipcbiAqIENyZWF0ZWQgYnkgUnlhbiBXaGl0bGV5IG9uIDUvMTcvMTQuXG4gKi9cbi8qKiBGb3JrZWQgZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9ER3VpZGkvMTcxNjAxMCAqKi9cblxudmFyIE1WVEZlYXR1cmUgPSByZXF1aXJlKCcuL01WVEZlYXR1cmUnKTtcblxudmFyIFV0aWwgPSByZXF1aXJlKCcuL01WVFV0aWwnKTtcbnZhciByYnVzaCA9IHJlcXVpcmUoJ3JidXNoJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5UaWxlTGF5ZXIuQ2FudmFzLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIGRlYnVnOiBmYWxzZSxcbiAgICBpc0hpZGRlbkxheWVyOiBmYWxzZSxcbiAgICBnZXRJREZvckxheWVyRmVhdHVyZTogZnVuY3Rpb24oKSB7fSxcbiAgICB0aWxlU2l6ZTogMjU2LFxuICAgIGxpbmVDbGlja1RvbGVyYW5jZTogMixcbiAgICBidWZmZXI6IDUsXG4gIH0sXG5cbiAgX2ZlYXR1cmVJc0NsaWNrZWQ6IHt9LFxuXG4gIF9pc1BvaW50SW5Qb2x5OiBmdW5jdGlvbihwdCwgcG9seSkge1xuICAgIGlmKHBvbHkgJiYgcG9seS5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGMgPSBmYWxzZSwgaSA9IC0xLCBsID0gcG9seS5sZW5ndGgsIGogPSBsIC0gMTsgKytpIDwgbDsgaiA9IGkpXG4gICAgICAgICgocG9seVtpXS55IDw9IHB0LnkgJiYgcHQueSA8IHBvbHlbal0ueSkgfHwgKHBvbHlbal0ueSA8PSBwdC55ICYmIHB0LnkgPCBwb2x5W2ldLnkpKVxuICAgICAgICAmJiAocHQueCA8IChwb2x5W2pdLnggLSBwb2x5W2ldLngpICogKHB0LnkgLSBwb2x5W2ldLnkpIC8gKHBvbHlbal0ueSAtIHBvbHlbaV0ueSkgKyBwb2x5W2ldLngpXG4gICAgICAgICYmIChjID0gIWMpO1xuICAgICAgcmV0dXJuIGM7XG4gICAgfVxuICB9LFxuXG4gIF9nZXREaXN0YW5jZUZyb21MaW5lOiBmdW5jdGlvbihwdCwgcHRzKSB7XG4gICAgdmFyIG1pbiA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICBpZiAocHRzICYmIHB0cy5sZW5ndGggPiAxKSB7XG4gICAgICBwdCA9IEwucG9pbnQocHQueCwgcHQueSk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHB0cy5sZW5ndGggLSAxOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciB0ZXN0ID0gdGhpcy5fcHJvamVjdFBvaW50T25MaW5lU2VnbWVudChwdCwgcHRzW2ldLCBwdHNbaSArIDFdKTtcbiAgICAgICAgaWYgKHRlc3QuZGlzdGFuY2UgPD0gbWluKSB7XG4gICAgICAgICAgbWluID0gdGVzdC5kaXN0YW5jZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWluO1xuICB9LFxuXG4gIF9wcm9qZWN0UG9pbnRPbkxpbmVTZWdtZW50OiBmdW5jdGlvbihwLCByMCwgcjEpIHtcbiAgICB2YXIgbGluZUxlbmd0aCA9IHIwLmRpc3RhbmNlVG8ocjEpO1xuICAgIGlmIChsaW5lTGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4ge2Rpc3RhbmNlOiBwLmRpc3RhbmNlVG8ocjApLCBjb29yZGluYXRlOiByMH07XG4gICAgfVxuICAgIHZhciB1ID0gKChwLnggLSByMC54KSAqIChyMS54IC0gcjAueCkgKyAocC55IC0gcjAueSkgKiAocjEueSAtIHIwLnkpKSAvIE1hdGgucG93KGxpbmVMZW5ndGgsIDIpO1xuICAgIGlmICh1IDwgMC4wMDAwMDAxKSB7XG4gICAgICAgIHJldHVybiB7ZGlzdGFuY2U6IHAuZGlzdGFuY2VUbyhyMCksIGNvb3JkaW5hdGU6IHIwfTtcbiAgICB9XG4gICAgaWYgKHUgPiAwLjk5OTk5OTkpIHtcbiAgICAgICAgcmV0dXJuIHtkaXN0YW5jZTogcC5kaXN0YW5jZVRvKHIxKSwgY29vcmRpbmF0ZTogcjF9O1xuICAgIH1cbiAgICB2YXIgYSA9IEwucG9pbnQocjAueCArIHUgKiAocjEueCAtIHIwLngpLCByMC55ICsgdSAqIChyMS55IC0gcjAueSkpO1xuICAgIHJldHVybiB7ZGlzdGFuY2U6IHAuZGlzdGFuY2VUbyhhKSwgcG9pbnQ6IGF9O1xuICB9LFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKG12dFNvdXJjZSwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLm12dFNvdXJjZSA9IG12dFNvdXJjZTtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIHRoaXMuc3R5bGUgPSBvcHRpb25zLnN0eWxlO1xuICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXMgPSB7fTtcbiAgICB0aGlzLmZlYXR1cmVzID0ge307XG4gICAgdGhpcy5mZWF0dXJlc1dpdGhMYWJlbHMgPSBbXTtcbiAgICB0aGlzLl9oaWdoZXN0Q291bnQgPSAwO1xuICB9LFxuXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICBMLlRpbGVMYXllci5DYW52YXMucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgfSxcblxuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5maXJlKCdyZW1vdmUnKTtcbiAgICByZW1vdmVMYWJlbHModGhpcyk7XG4gICAgTC5UaWxlTGF5ZXIuQ2FudmFzLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gIH0sXG5cbiAgZHJhd1RpbGU6IGZ1bmN0aW9uKGNhbnZhcywgdGlsZVBvaW50LCB6b29tKSB7XG5cbiAgICB2YXIgY3R4ID0ge1xuICAgICAgY2FudmFzOiBjYW52YXMsXG4gICAgICB0aWxlOiB0aWxlUG9pbnQsXG4gICAgICB6b29tOiB6b29tLFxuICAgICAgdGlsZVNpemU6IHRoaXMub3B0aW9ucy50aWxlU2l6ZVxuICAgIH07XG5cbiAgICBjdHguaWQgPSBVdGlsLmdldENvbnRleHRJRChjdHgpO1xuXG4gICAgaWYgKCF0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNbY3R4LmlkXSkge1xuICAgICAgdGhpcy5faW5pdGlhbGl6ZUZlYXR1cmVzSGFzaChjdHgpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIHRoaXMuZmVhdHVyZXMgPSB7fTtcbiAgICB9XG5cbiAgfSxcblxuICBfaW5pdGlhbGl6ZUZlYXR1cmVzSGFzaDogZnVuY3Rpb24oY3R4KXtcbiAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNbY3R4LmlkXSA9IHtcbiAgICAgIGZlYXR1cmVzOiBbXSxcbiAgICAgIGNhbnZhczogY3R4LmNhbnZhcyxcbiAgICAgIGluZGV4OiByYnVzaCg5KVxuICAgIH07XG4gIH0sXG5cbiAgX2RyYXc6IGZ1bmN0aW9uKGN0eCkge1xuICAgIC8vRHJhdyBpcyBoYW5kbGVkIGJ5IHRoZSBwYXJlbnQgTVZUU291cmNlIG9iamVjdFxuICB9LFxuICBnZXRDYW52YXM6IGZ1bmN0aW9uKHBhcmVudEN0eCl7XG4gICAgLy9UaGlzIGdldHMgY2FsbGVkIGlmIGEgdmVjdG9yIHRpbGUgZmVhdHVyZSBoYXMgYWxyZWFkeSBiZWVuIHBhcnNlZC5cbiAgICAvL1dlJ3ZlIGFscmVhZHkgZ290IHRoZSBnZW9tLCBqdXN0IGdldCBvbiB3aXRoIHRoZSBkcmF3aW5nLlxuICAgIC8vTmVlZCBhIHdheSB0byBwbHVjayBhIGNhbnZhcyBlbGVtZW50IGZyb20gdGhpcyBsYXllciBnaXZlbiB0aGUgcGFyZW50IGxheWVyJ3MgaWQuXG4gICAgLy9XYWl0IGZvciBpdCB0byBnZXQgbG9hZGVkIGJlZm9yZSBwcm9jZWVkaW5nLlxuICAgIHZhciB0aWxlUG9pbnQgPSBwYXJlbnRDdHgudGlsZTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fdGlsZXNbdGlsZVBvaW50LnggKyBcIjpcIiArIHRpbGVQb2ludC55XTtcblxuICAgIGlmKGN0eCl7XG4gICAgICBwYXJlbnRDdHguY2FudmFzID0gY3R4O1xuICAgICAgdGhpcy5yZWRyYXdUaWxlKHBhcmVudEN0eC5pZCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy9UaGlzIGlzIGEgdGltZXIgdGhhdCB3aWxsIHdhaXQgZm9yIGEgY3JpdGVyaW9uIHRvIHJldHVybiB0cnVlLlxuICAgIC8vSWYgbm90IHRydWUgd2l0aGluIHRoZSB0aW1lb3V0IGR1cmF0aW9uLCBpdCB3aWxsIG1vdmUgb24uXG4gICAgd2FpdEZvcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGN0eCA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG4gICAgICAgIGlmKGN0eCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgLy9XaGVuIGl0IGZpbmlzaGVzLCBkbyB0aGlzLlxuICAgICAgICBjdHggPSBzZWxmLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuICAgICAgICBwYXJlbnRDdHguY2FudmFzID0gY3R4O1xuICAgICAgICBzZWxmLnJlZHJhd1RpbGUocGFyZW50Q3R4LmlkKTtcblxuICAgICAgfSwgLy93aGVuIGRvbmUsIGdvIHRvIG5leHQgZmxvd1xuICAgICAgMjAwMCk7IC8vVGhlIFRpbWVvdXQgbWlsbGlzZWNvbmRzLiAgQWZ0ZXIgdGhpcywgZ2l2ZSB1cCBhbmQgbW92ZSBvblxuXG4gIH0sXG5cbiAgcGFyc2VWZWN0b3JUaWxlTGF5ZXI6IGZ1bmN0aW9uKHZ0bCwgY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB0aWxlUG9pbnQgPSBjdHgudGlsZTtcbiAgICB2YXIgbGF5ZXJDdHggID0geyBjYW52YXM6IG51bGwsIGlkOiBjdHguaWQsIHRpbGU6IGN0eC50aWxlLCB6b29tOiBjdHguem9vbSwgdGlsZVNpemU6IGN0eC50aWxlU2l6ZX07XG5cbiAgICAvL1NlZSBpZiB3ZSBjYW4gcGx1Y2sgdGhlIGNoaWxkIHRpbGUgZnJvbSB0aGlzIFBCRiB0aWxlIGxheWVyIGJhc2VkIG9uIHRoZSBtYXN0ZXIgbGF5ZXIncyB0aWxlIGlkLlxuICAgIGxheWVyQ3R4LmNhbnZhcyA9IHNlbGYuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG5cbiAgICAvL0luaXRpYWxpemUgdGhpcyB0aWxlJ3MgZmVhdHVyZSBzdG9yYWdlIGhhc2gsIGlmIGl0IGhhc24ndCBhbHJlYWR5IGJlZW4gY3JlYXRlZC4gIFVzZWQgZm9yIHdoZW4gZmlsdGVycyBhcmUgdXBkYXRlZCwgYW5kIGZlYXR1cmVzIGFyZSBjbGVhcmVkIHRvIHByZXBhcmUgZm9yIGEgZnJlc2ggcmVkcmF3LlxuICAgIGlmICghdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2xheWVyQ3R4LmlkXSkge1xuICAgICAgdGhpcy5faW5pdGlhbGl6ZUZlYXR1cmVzSGFzaChsYXllckN0eCk7XG4gICAgfWVsc2V7XG4gICAgICAvL0NsZWFyIHRoaXMgdGlsZSdzIHByZXZpb3VzbHkgc2F2ZWQgZmVhdHVyZXMuXG4gICAgICB0aGlzLmNsZWFyVGlsZUZlYXR1cmVIYXNoKGxheWVyQ3R4LmlkKTtcbiAgICB9XG5cbiAgICB2YXIgZmVhdHVyZXMgPSB2dGwucGFyc2VkRmVhdHVyZXM7XG4gICAgdmFyIHRvSW5kZXggPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciB2dGYgPSBmZWF0dXJlc1tpXTsgLy92ZWN0b3IgdGlsZSBmZWF0dXJlXG5cbiAgICAgIC8qKlxuICAgICAgICogQXBwbHkgZmlsdGVyIG9uIGZlYXR1cmUgaWYgdGhlcmUgaXMgb25lLiBEZWZpbmVkIGluIHRoZSBvcHRpb25zIG9iamVjdFxuICAgICAgICogb2YgVGlsZUxheWVyLk1WVFNvdXJjZS5qc1xuICAgICAgICovXG4gICAgICB2YXIgZmlsdGVyID0gc2VsZi5vcHRpb25zLmZpbHRlcjtcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGlmICggZmlsdGVyKHZ0ZiwgbGF5ZXJDdHgpID09PSBmYWxzZSApIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgICBpZiAodHlwZW9mIHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBnZXRJREZvckxheWVyRmVhdHVyZSA9IHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGdldElERm9yTGF5ZXJGZWF0dXJlID0gVXRpbC5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICAgIH1cbiAgICAgIHZhciB1bmlxdWVJRCA9IHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZSh2dGYpIHx8IGk7XG4gICAgICB2YXIgbXZ0RmVhdHVyZSA9IHNlbGYuZmVhdHVyZXNbdW5pcXVlSURdO1xuXG4gICAgICAvKipcbiAgICAgICAqIEluZGV4IHRoZSBmZWF0dXJlIGJ5IGJvdW5kaW5nIGJveCBpbnRvIHJidXNoLlxuICAgICAgICovXG4gICAgICB2YXIgYnVmZmVyID0gMDtcbiAgICAgIC8vIGFkZCBidWZmZXIgdG8gaW5kZXggZm9yIHBvaW50cyAoaWdub3JlIGZvciBvdGhlciB0eXBlcylcbiAgICAgIGlmICh2dGYudHlwZSA9PT0gMSkgeyBidWZmZXIgPSBzZWxmLm9wdGlvbnMuYnVmZmVyOyB9XG4gICAgICB2YXIgYm94ID0gYmJveCh2dGYsIGxheWVyQ3R4LnRpbGVTaXplLCB1bmlxdWVJRCwgYnVmZmVyKTtcbiAgICAgIHRvSW5kZXgucHVzaChib3gpO1xuXG4gICAgICAvKipcbiAgICAgICAqIFVzZSBsYXllck9yZGVyaW5nIGZ1bmN0aW9uIHRvIGFwcGx5IGEgekluZGV4IHByb3BlcnR5IHRvIGVhY2ggdnRmLiAgVGhpcyBpcyBkZWZpbmVkIGluXG4gICAgICAgKiBUaWxlTGF5ZXIuTVZUU291cmNlLmpzLiAgVXNlZCBiZWxvdyB0byBzb3J0IGZlYXR1cmVzLm5wbVxuICAgICAgICovXG4gICAgICB2YXIgbGF5ZXJPcmRlcmluZyA9IHNlbGYub3B0aW9ucy5sYXllck9yZGVyaW5nO1xuICAgICAgaWYgKHR5cGVvZiBsYXllck9yZGVyaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGxheWVyT3JkZXJpbmcodnRmLCBsYXllckN0eCk7IC8vQXBwbGllcyBhIGN1c3RvbSBwcm9wZXJ0eSB0byB0aGUgZmVhdHVyZSwgd2hpY2ggaXMgdXNlZCBhZnRlciB3ZSdyZSB0aHJ1IGl0ZXJhdGluZyB0byBzb3J0XG4gICAgICB9XG5cbiAgICAgIC8vQ3JlYXRlIGEgbmV3IE1WVEZlYXR1cmUgaWYgb25lIGRvZXNuJ3QgYWxyZWFkeSBleGlzdCBmb3IgdGhpcyBmZWF0dXJlLlxuICAgICAgaWYgKCFtdnRGZWF0dXJlKSB7XG5cbiAgICAgICAgLy9HZXQgYSBzdHlsZSBmb3IgdGhlIGZlYXR1cmUgLSBzZXQgaXQganVzdCBvbmNlIGZvciBlYWNoIG5ldyBNVlRGZWF0dXJlXG4gICAgICAgIHZhciBzdHlsZSA9IHNlbGYuc3R5bGUodnRmKTtcblxuICAgICAgICAvL2NyZWF0ZSBhIG5ldyBmZWF0dXJlXG4gICAgICAgIHNlbGYuZmVhdHVyZXNbdW5pcXVlSURdID0gbXZ0RmVhdHVyZSA9IG5ldyBNVlRGZWF0dXJlKHNlbGYsIHZ0ZiwgbGF5ZXJDdHgsIHVuaXF1ZUlELCBzdHlsZSk7XG4gICAgICAgIGlmIChzdHlsZSAmJiBzdHlsZS5keW5hbWljTGFiZWwgJiYgdHlwZW9mIHN0eWxlLmR5bmFtaWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHNlbGYuZmVhdHVyZXNXaXRoTGFiZWxzLnB1c2gobXZ0RmVhdHVyZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vQWRkIHRoZSBuZXcgcGFydCB0byB0aGUgZXhpc3RpbmcgZmVhdHVyZVxuICAgICAgICBtdnRGZWF0dXJlLmFkZFRpbGVGZWF0dXJlKHZ0ZiwgbGF5ZXJDdHgpO1xuICAgICAgfVxuXG4gICAgICAvL0Fzc29jaWF0ZSAmIFNhdmUgdGhpcyBmZWF0dXJlIHdpdGggdGhpcyB0aWxlIGZvciBsYXRlclxuICAgICAgc2VsZi5fY2FudmFzSURUb0ZlYXR1cmVzW2xheWVyQ3R4LmlkXS5mZWF0dXJlcy5wdXNoKG12dEZlYXR1cmUpO1xuXG4gICAgfVxuICAgIHNlbGYuX2NhbnZhc0lEVG9GZWF0dXJlc1tsYXllckN0eC5pZF0uaW5kZXgubG9hZCh0b0luZGV4KTtcblxuICAgIC8qKlxuICAgICAqIEFwcGx5IHNvcnRpbmcgKHpJbmRleCkgb24gZmVhdHVyZSBpZiB0aGVyZSBpcyBhIGZ1bmN0aW9uIGRlZmluZWQgaW4gdGhlIG9wdGlvbnMgb2JqZWN0XG4gICAgICogb2YgVGlsZUxheWVyLk1WVFNvdXJjZS5qc1xuICAgICAqL1xuICAgIHZhciBsYXllck9yZGVyaW5nID0gc2VsZi5vcHRpb25zLmxheWVyT3JkZXJpbmc7XG4gICAgaWYgKGxheWVyT3JkZXJpbmcpIHtcbiAgICAgIC8vV2UndmUgYXNzaWduZWQgdGhlIGN1c3RvbSB6SW5kZXggcHJvcGVydHkgd2hlbiBpdGVyYXRpbmcgYWJvdmUuICBOb3cganVzdCBzb3J0LlxuICAgICAgc2VsZi5fY2FudmFzSURUb0ZlYXR1cmVzW2xheWVyQ3R4LmlkXS5mZWF0dXJlcyA9IHNlbGYuX2NhbnZhc0lEVG9GZWF0dXJlc1tsYXllckN0eC5pZF0uZmVhdHVyZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiAtKGIucHJvcGVydGllcy56SW5kZXggLSBhLnByb3BlcnRpZXMuekluZGV4KVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2VsZi5yZWRyYXdUaWxlKGxheWVyQ3R4LmlkKTtcbiAgfSxcblxuICBzZXRTdHlsZTogZnVuY3Rpb24oc3R5bGVGbikge1xuICAgIC8vIHJlZnJlc2ggdGhlIG51bWJlciBmb3IgdGhlIGhpZ2hlc3QgY291bnQgdmFsdWVcbiAgICAvLyB0aGlzIGlzIHVzZWQgb25seSBmb3IgY2hvcm9wbGV0aFxuICAgIHRoaXMuX2hpZ2hlc3RDb3VudCA9IDA7XG5cbiAgICAvLyBsb3dlc3QgY291bnQgc2hvdWxkIG5vdCBiZSAwLCBzaW5jZSB3ZSB3YW50IHRvIGZpZ3VyZSBvdXQgdGhlIGxvd2VzdFxuICAgIHRoaXMuX2xvd2VzdENvdW50ID0gbnVsbDtcblxuICAgIHRoaXMuc3R5bGUgPSBzdHlsZUZuO1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmZlYXR1cmVzKSB7XG4gICAgICB2YXIgZmVhdCA9IHRoaXMuZmVhdHVyZXNba2V5XTtcbiAgICAgIGZlYXQuc2V0U3R5bGUoc3R5bGVGbik7XG4gICAgfVxuICAgIHZhciB6ID0gdGhpcy5tYXAuZ2V0Wm9vbSgpO1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLl90aWxlcykge1xuICAgICAgdmFyIGlkID0geiArICc6JyArIGtleTtcbiAgICAgIHRoaXMucmVkcmF3VGlsZShpZCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBBcyBjb3VudHMgZm9yIGNob3JvcGxldGhzIGNvbWUgaW4gd2l0aCB0aGUgYWpheCBkYXRhLFxuICAgKiB3ZSB3YW50IHRvIGtlZXAgdHJhY2sgb2Ygd2hpY2ggdmFsdWUgaXMgdGhlIGhpZ2hlc3RcbiAgICogdG8gY3JlYXRlIHRoZSBjb2xvciByYW1wIGZvciB0aGUgZmlsbHMgb2YgcG9seWdvbnMuXG4gICAqIEBwYXJhbSBjb3VudFxuICAgKi9cbiAgc2V0SGlnaGVzdENvdW50OiBmdW5jdGlvbihjb3VudCkge1xuICAgIGlmIChjb3VudCA+IHRoaXMuX2hpZ2hlc3RDb3VudCkge1xuICAgICAgdGhpcy5faGlnaGVzdENvdW50ID0gY291bnQ7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBoaWdoZXN0IG51bWJlciBvZiBhbGwgb2YgdGhlIGNvdW50cyB0aGF0IGhhdmUgY29tZSBpblxuICAgKiBmcm9tIHNldEhpZ2hlc3RDb3VudC4gVGhpcyBpcyBhc3N1bWVkIHRvIGJlIHNldCB2aWEgYWpheCBjYWxsYmFja3MuXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAqL1xuICBnZXRIaWdoZXN0Q291bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9oaWdoZXN0Q291bnQ7XG4gIH0sXG5cbiAgc2V0TG93ZXN0Q291bnQ6IGZ1bmN0aW9uKGNvdW50KSB7XG4gICAgaWYgKCF0aGlzLl9sb3dlc3RDb3VudCB8fCBjb3VudCA8IHRoaXMuX2xvd2VzdENvdW50KSB7XG4gICAgICB0aGlzLl9sb3dlc3RDb3VudCA9IGNvdW50O1xuICAgIH1cbiAgfSxcblxuICBnZXRMb3dlc3RDb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xvd2VzdENvdW50O1xuICB9LFxuXG4gIHNldENvdW50UmFuZ2U6IGZ1bmN0aW9uKGNvdW50KSB7XG4gICAgdGhpcy5zZXRIaWdoZXN0Q291bnQoY291bnQpO1xuICAgIHRoaXMuc2V0TG93ZXN0Q291bnQoY291bnQpO1xuICB9LFxuXG4gIGZlYXR1cmVBdDogZnVuY3Rpb24odGlsZUlELCB0aWxlUGl4ZWxQb2ludCkge1xuICAgIGlmICghdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW3RpbGVJRF0pIHJldHVybiBudWxsOyAvLyBicmVhayBvdXRcblxuICAgIHZhciB6b29tID0gdGlsZUlELnNwbGl0KFwiOlwiKVswXTtcbiAgICB2YXIgeCA9IHRpbGVQaXhlbFBvaW50Lng7XG4gICAgdmFyIHkgPSB0aWxlUGl4ZWxQb2ludC55O1xuXG4gICAgdmFyIGluZGV4ID0gdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW3RpbGVJRF0uaW5kZXg7XG5cbiAgICB2YXIgbWluRGlzdGFuY2UgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgdmFyIG5lYXJlc3QgPSBudWxsO1xuICAgIHZhciBqLCBwYXRocywgZGlzdGFuY2U7XG5cbiAgICB2YXIgbWF0Y2hlcyA9IGluZGV4LnNlYXJjaChbeCwgeSwgeCwgeV0pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWF0Y2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZlYXR1cmUgPSB0aGlzLmZlYXR1cmVzW21hdGNoZXNbaV0uaWRdO1xuICAgICAgc3dpdGNoIChmZWF0dXJlLnR5cGUpIHtcblxuICAgICAgICBjYXNlIDE6IC8vUG9pbnQgLSBjdXJyZW50bHkgcmVuZGVyZWQgYXMgY2lyY3VsYXIgcGF0aHMuICBJbnRlcnNlY3Qgd2l0aCB0aGF0LlxuXG4gICAgICAgICAgLy9GaW5kIHRoZSByYWRpdXMgb2YgdGhlIHBvaW50LlxuICAgICAgICAgIHZhciByYWRpdXMgPSAzO1xuICAgICAgICAgIGlmICh0eXBlb2YgZmVhdHVyZS5zdHlsZS5yYWRpdXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJhZGl1cyA9IGZlYXR1cmUuc3R5bGUucmFkaXVzKHpvb20pOyAvL0FsbG93cyBmb3Igc2NhbGUgZGVwZW5kZW50IHJlZG5lcmluZ1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgcmFkaXVzID0gZmVhdHVyZS5zdHlsZS5yYWRpdXM7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcGF0aHMgPSBmZWF0dXJlLmdldFBhdGhzRm9yVGlsZSh0aWxlSUQpO1xuICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXRocy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgLy9CdWlsZHMgYSBjaXJjbGUgb2YgcmFkaXVzIGZlYXR1cmUuc3R5bGUucmFkaXVzIChhc3N1bWluZyBjaXJjdWxhciBwb2ludCBzeW1ib2xvZ3kpLlxuICAgICAgICAgICAgaWYoaW5fY2lyY2xlKHBhdGhzW2pdWzBdLngsIHBhdGhzW2pdWzBdLnksIHJhZGl1cywgeCwgeSkpe1xuICAgICAgICAgICAgICBuZWFyZXN0ID0gZmVhdHVyZTtcbiAgICAgICAgICAgICAgbWluRGlzdGFuY2UgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIDI6IC8vTGluZVN0cmluZ1xuICAgICAgICAgIHBhdGhzID0gZmVhdHVyZS5nZXRQYXRoc0ZvclRpbGUodGlsZUlEKTtcbiAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcGF0aHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChmZWF0dXJlLnN0eWxlKSB7XG4gICAgICAgICAgICAgIHZhciBkaXN0YW5jZSA9IHRoaXMuX2dldERpc3RhbmNlRnJvbUxpbmUodGlsZVBpeGVsUG9pbnQsIHBhdGhzW2pdKTtcbiAgICAgICAgICAgICAgdmFyIHRoaWNrbmVzcyA9IChmZWF0dXJlLnNlbGVjdGVkICYmIGZlYXR1cmUuc3R5bGUuc2VsZWN0ZWQgPyBmZWF0dXJlLnN0eWxlLnNlbGVjdGVkLnNpemUgOiBmZWF0dXJlLnN0eWxlLnNpemUpO1xuICAgICAgICAgICAgICBpZiAoZGlzdGFuY2UgPCB0aGlja25lc3MgLyAyICsgdGhpcy5vcHRpb25zLmxpbmVDbGlja1RvbGVyYW5jZSAmJiBkaXN0YW5jZSA8IG1pbkRpc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgbmVhcmVzdCA9IGZlYXR1cmU7XG4gICAgICAgICAgICAgICAgbWluRGlzdGFuY2UgPSBkaXN0YW5jZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIDM6IC8vUG9seWdvblxuICAgICAgICAgIHBhdGhzID0gZmVhdHVyZS5nZXRQYXRoc0ZvclRpbGUodGlsZUlEKTtcbiAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcGF0aHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc1BvaW50SW5Qb2x5KHRpbGVQaXhlbFBvaW50LCBwYXRoc1tqXSkpIHtcbiAgICAgICAgICAgICAgbmVhcmVzdCA9IGZlYXR1cmU7XG4gICAgICAgICAgICAgIG1pbkRpc3RhbmNlID0gMDsgLy8gcG9pbnQgaXMgaW5zaWRlIHRoZSBwb2x5Z29uLCBzbyBkaXN0YW5jZSBpcyB6ZXJvXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG1pbkRpc3RhbmNlID09IDApIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBuZWFyZXN0O1xuICB9LFxuXG4gIGNsZWFyVGlsZTogZnVuY3Rpb24oaWQpIHtcbiAgICAvL2lkIGlzIHRoZSBlbnRpcmUgem9vbTp4OnkuICB3ZSBqdXN0IHdhbnQgeDp5LlxuICAgIHZhciBjYSA9IGlkLnNwbGl0KFwiOlwiKTtcbiAgICB2YXIgY2FudmFzSWQgPSBjYVsxXSArIFwiOlwiICsgY2FbMl07XG4gICAgaWYgKHR5cGVvZiB0aGlzLl90aWxlc1tjYW52YXNJZF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwidHlwZW9mIHRoaXMuX3RpbGVzW2NhbnZhc0lkXSA9PT0gJ3VuZGVmaW5lZCdcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBjYW52YXMgPSB0aGlzLl90aWxlc1tjYW52YXNJZF07XG5cbiAgICB2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGNvbnRleHQuY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gIH0sXG5cbiAgY2xlYXJUaWxlRmVhdHVyZUhhc2g6IGZ1bmN0aW9uKGNhbnZhc0lEKSB7XG4gICAgLy8gR2V0IHJpZCBvZiBhbGwgc2F2ZWQgZmVhdHVyZXNcbiAgICB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNbY2FudmFzSURdLmZlYXR1cmVzID0gW107XG4gICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2NhbnZhc0lEXS5pbmRleCA9IHJidXNoKDkpO1xuICB9LFxuXG4gIGNsZWFyTGF5ZXJGZWF0dXJlSGFzaDogZnVuY3Rpb24oKXtcbiAgICB0aGlzLmZlYXR1cmVzID0ge307XG4gIH0sXG5cbiAgcmVkcmF3VGlsZTogZnVuY3Rpb24oY2FudmFzSUQpIHtcbiAgICAvL0ZpcnN0LCBjbGVhciB0aGUgY2FudmFzXG4gICAgdGhpcy5jbGVhclRpbGUoY2FudmFzSUQpO1xuXG4gICAgLy8gSWYgdGhlIGZlYXR1cmVzIGFyZSBub3QgaW4gdGhlIHRpbGUsIHRoZW4gdGhlcmUgaXMgbm90aGluZyB0byByZWRyYXcuXG4gICAgLy8gVGhpcyBtYXkgaGFwcGVuIGlmIHlvdSBjYWxsIHJlZHJhdyBiZWZvcmUgZmVhdHVyZXMgaGF2ZSBsb2FkZWQgYW5kIGluaXRpYWxseVxuICAgIC8vIGRyYXduIHRoZSB0aWxlLlxuICAgIHZhciBmZWF0ZmVhdHMgPSB0aGlzLl9jYW52YXNJRFRvRmVhdHVyZXNbY2FudmFzSURdO1xuICAgIGlmICghZmVhdGZlYXRzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9HZXQgdGhlIGZlYXR1cmVzIGZvciB0aGlzIHRpbGUsIGFuZCByZWRyYXcgdGhlbS5cbiAgICB2YXIgZmVhdHVyZXMgPSBmZWF0ZmVhdHMuZmVhdHVyZXM7XG5cbiAgICAvLyB3ZSB3YW50IHRvIHNraXAgZHJhd2luZyB0aGUgc2VsZWN0ZWQgZmVhdHVyZXMgYW5kIGRyYXcgdGhlbSBsYXN0XG4gICAgdmFyIHNlbGVjdGVkRmVhdHVyZXMgPSBbXTtcblxuICAgIC8vIGRyYXdpbmcgYWxsIG9mIHRoZSBub24tc2VsZWN0ZWQgZmVhdHVyZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVzW2ldO1xuICAgICAgaWYgKGZlYXR1cmUuc2VsZWN0ZWQpIHtcbiAgICAgICAgc2VsZWN0ZWRGZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmVhdHVyZS5kcmF3KGNhbnZhc0lEKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkcmF3aW5nIHRoZSBzZWxlY3RlZCBmZWF0dXJlcyBsYXN0XG4gICAgZm9yICh2YXIgaiA9IDAsIGxlbjIgPSBzZWxlY3RlZEZlYXR1cmVzLmxlbmd0aDsgaiA8IGxlbjI7IGorKykge1xuICAgICAgdmFyIHNlbEZlYXQgPSBzZWxlY3RlZEZlYXR1cmVzW2pdO1xuICAgICAgc2VsRmVhdC5kcmF3KGNhbnZhc0lEKTtcbiAgICB9XG4gIH0sXG5cbiAgbGlua2VkTGF5ZXI6IGZ1bmN0aW9uKCkge1xuICAgIGlmKHRoaXMubXZ0U291cmNlLmxheWVyTGluaykge1xuICAgICAgdmFyIGxpbmtOYW1lID0gdGhpcy5tdnRTb3VyY2UubGF5ZXJMaW5rKHRoaXMubmFtZSk7XG4gICAgICByZXR1cm4gdGhpcy5tdnRTb3VyY2UubGF5ZXJzW2xpbmtOYW1lXTtcbiAgICB9XG4gICAgZWxzZXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSxcblxuICBmZWF0dXJlV2l0aExhYmVsQWRkZWQ6IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgICB0aGlzLmZlYXR1cmVzV2l0aExhYmVscy5wdXNoKGZlYXR1cmUpO1xuICB9XG5cbn0pO1xuXG5mdW5jdGlvbiBiYm94KHZ0ZiwgdGlsZVNpemUsIGlkLCBidWZmZXIpIHtcbiAgdmFyIGRpdmlzb3IgPSB2dGYuZXh0ZW50IC8gdGlsZVNpemU7XG5cbiAgdmFyIG1pblggPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIHZhciBtYXhYID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xuICB2YXIgbWluWSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgdmFyIG1heFkgPSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFk7XG4gIHZ0Zi5jb29yZGluYXRlcy5mb3JFYWNoKGZ1bmN0aW9uKGNvb3JkaW5hdGVzKSB7XG4gICAgY29vcmRpbmF0ZXMuZm9yRWFjaChmdW5jdGlvbihjb29yZGluYXRlKSB7XG4gICAgICB2YXIgeCA9IGNvb3JkaW5hdGUueCAvIGRpdmlzb3I7XG4gICAgICB2YXIgeSA9IGNvb3JkaW5hdGUueSAvIGRpdmlzb3I7XG4gICAgICBtaW5YID0gTWF0aC5taW4obWluWCwgeCk7XG4gICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgeCk7XG4gICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgeSk7XG4gICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgeSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGlmIChidWZmZXIgPiAwKSB7XG4gICAgbWluWCAtPSBidWZmZXI7XG4gICAgbWF4WCArPSBidWZmZXI7XG4gICAgbWluWSAtPSBidWZmZXI7XG4gICAgbWF4WSArPSBidWZmZXI7XG4gIH1cbiAgdmFyIGJveCA9IFttaW5YLCBtaW5ZLCBtYXhYLCBtYXhZXTtcbiAgYm94LmlkID0gaWQ7XG4gIHJldHVybiBib3g7XG59XG5cblxuZnVuY3Rpb24gcmVtb3ZlTGFiZWxzKHNlbGYpIHtcbiAgdmFyIGZlYXR1cmVzID0gc2VsZi5mZWF0dXJlc1dpdGhMYWJlbHM7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBmZWF0ID0gZmVhdHVyZXNbaV07XG4gICAgZmVhdC5yZW1vdmVMYWJlbCgpO1xuICB9XG4gIHNlbGYuZmVhdHVyZXNXaXRoTGFiZWxzID0gW107XG59XG5cbmZ1bmN0aW9uIGluX2NpcmNsZShjZW50ZXJfeCwgY2VudGVyX3ksIHJhZGl1cywgeCwgeSkge1xuICB2YXIgc3F1YXJlX2Rpc3QgPSBNYXRoLnBvdygoY2VudGVyX3ggLSB4KSwgMikgKyBNYXRoLnBvdygoY2VudGVyX3kgLSB5KSwgMik7XG4gIHJldHVybiBzcXVhcmVfZGlzdCA8PSBNYXRoLnBvdyhyYWRpdXMsIDIpO1xufVxuLyoqXG4gKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FyaXlhL3BoYW50b21qcy9ibG9iL21hc3Rlci9leGFtcGxlcy93YWl0Zm9yLmpzXG4gKlxuICogV2FpdCB1bnRpbCB0aGUgdGVzdCBjb25kaXRpb24gaXMgdHJ1ZSBvciBhIHRpbWVvdXQgb2NjdXJzLiBVc2VmdWwgZm9yIHdhaXRpbmdcbiAqIG9uIGEgc2VydmVyIHJlc3BvbnNlIG9yIGZvciBhIHVpIGNoYW5nZSAoZmFkZUluLCBldGMuKSB0byBvY2N1ci5cbiAqXG4gKiBAcGFyYW0gdGVzdEZ4IGphdmFzY3JpcHQgY29uZGl0aW9uIHRoYXQgZXZhbHVhdGVzIHRvIGEgYm9vbGVhbixcbiAqIGl0IGNhbiBiZSBwYXNzZWQgaW4gYXMgYSBzdHJpbmcgKGUuZy46IFwiMSA9PSAxXCIgb3IgXCIkKCcjYmFyJykuaXMoJzp2aXNpYmxlJylcIiBvclxuICogYXMgYSBjYWxsYmFjayBmdW5jdGlvbi5cbiAqIEBwYXJhbSBvblJlYWR5IHdoYXQgdG8gZG8gd2hlbiB0ZXN0RnggY29uZGl0aW9uIGlzIGZ1bGZpbGxlZCxcbiAqIGl0IGNhbiBiZSBwYXNzZWQgaW4gYXMgYSBzdHJpbmcgKGUuZy46IFwiMSA9PSAxXCIgb3IgXCIkKCcjYmFyJykuaXMoJzp2aXNpYmxlJylcIiBvclxuICogYXMgYSBjYWxsYmFjayBmdW5jdGlvbi5cbiAqIEBwYXJhbSB0aW1lT3V0TWlsbGlzIHRoZSBtYXggYW1vdW50IG9mIHRpbWUgdG8gd2FpdC4gSWYgbm90IHNwZWNpZmllZCwgMyBzZWMgaXMgdXNlZC5cbiAqL1xuZnVuY3Rpb24gd2FpdEZvcih0ZXN0RngsIG9uUmVhZHksIHRpbWVPdXRNaWxsaXMpIHtcbiAgdmFyIG1heHRpbWVPdXRNaWxsaXMgPSB0aW1lT3V0TWlsbGlzID8gdGltZU91dE1pbGxpcyA6IDMwMDAsIC8vPCBEZWZhdWx0IE1heCBUaW1vdXQgaXMgM3NcbiAgICBzdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgIGNvbmRpdGlvbiA9ICh0eXBlb2YgKHRlc3RGeCkgPT09IFwic3RyaW5nXCIgPyBldmFsKHRlc3RGeCkgOiB0ZXN0RngoKSksIC8vPCBkZWZlbnNpdmUgY29kZVxuICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0IDwgbWF4dGltZU91dE1pbGxpcykgJiYgIWNvbmRpdGlvbikge1xuICAgICAgICAvLyBJZiBub3QgdGltZS1vdXQgeWV0IGFuZCBjb25kaXRpb24gbm90IHlldCBmdWxmaWxsZWRcbiAgICAgICAgY29uZGl0aW9uID0gKHR5cGVvZiAodGVzdEZ4KSA9PT0gXCJzdHJpbmdcIiA/IGV2YWwodGVzdEZ4KSA6IHRlc3RGeCgpKTsgLy88IGRlZmVuc2l2ZSBjb2RlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgIC8vIElmIGNvbmRpdGlvbiBzdGlsbCBub3QgZnVsZmlsbGVkICh0aW1lb3V0IGJ1dCBjb25kaXRpb24gaXMgJ2ZhbHNlJylcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIid3YWl0Rm9yKCknIHRpbWVvdXRcIik7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7IC8vPCBTdG9wIHRoaXMgaW50ZXJ2YWxcbiAgICAgICAgICB0eXBlb2YgKG9uUmVhZHkpID09PSBcInN0cmluZ1wiID8gZXZhbChvblJlYWR5KSA6IG9uUmVhZHkoJ3RpbWVvdXQnKTsgLy88IERvIHdoYXQgaXQncyBzdXBwb3NlZCB0byBkbyBvbmNlIHRoZSBjb25kaXRpb24gaXMgZnVsZmlsbGVkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ29uZGl0aW9uIGZ1bGZpbGxlZCAodGltZW91dCBhbmQvb3IgY29uZGl0aW9uIGlzICd0cnVlJylcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIid3YWl0Rm9yKCknIGZpbmlzaGVkIGluIFwiICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnQpICsgXCJtcy5cIik7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7IC8vPCBTdG9wIHRoaXMgaW50ZXJ2YWxcbiAgICAgICAgICB0eXBlb2YgKG9uUmVhZHkpID09PSBcInN0cmluZ1wiID8gZXZhbChvblJlYWR5KSA6IG9uUmVhZHkoJ3N1Y2Nlc3MnKTsgLy88IERvIHdoYXQgaXQncyBzdXBwb3NlZCB0byBkbyBvbmNlIHRoZSBjb25kaXRpb24gaXMgZnVsZmlsbGVkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCA1MCk7IC8vPCByZXBlYXQgY2hlY2sgZXZlcnkgNTBtc1xufTtcbiIsInZhciBWZWN0b3JUaWxlID0gcmVxdWlyZSgndmVjdG9yLXRpbGUnKS5WZWN0b3JUaWxlO1xudmFyIFByb3RvYnVmID0gcmVxdWlyZSgncGJmJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCdwb2ludC1nZW9tZXRyeScpO1xudmFyIFV0aWwgPSByZXF1aXJlKCcuL01WVFV0aWwnKTtcbnZhciBNVlRMYXllciA9IHJlcXVpcmUoJy4vTVZUTGF5ZXInKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEwuVGlsZUxheWVyLk1WVFNvdXJjZSA9IEwuVGlsZUxheWVyLkNhbnZhcy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBkZWJ1ZzogZmFsc2UsXG4gICAgdXJsOiBcIlwiLCAvL1VSTCBUTyBWZWN0b3IgVGlsZSBTb3VyY2UsXG4gICAgZ2V0SURGb3JMYXllckZlYXR1cmU6IGZ1bmN0aW9uKCkge30sXG4gICAgdGlsZVNpemU6IDI1NixcbiAgICB2aXNpYmxlTGF5ZXJzOiBudWxsLFxuICAgIGJ1ZmZlcjogNSxcbiAgICB4aHJIZWFkZXJzOiB7fVxuICB9LFxuICBsYXllcnM6IHt9LCAvL0tlZXAgYSBsaXN0IG9mIHRoZSBsYXllcnMgY29udGFpbmVkIGluIHRoZSBQQkZzXG4gIHByb2Nlc3NlZFRpbGVzOiB7fSwgLy9LZWVwIGEgbGlzdCBvZiB0aWxlcyB0aGF0IGhhdmUgYmVlbiBwcm9jZXNzZWQgYWxyZWFkeVxuICBfZXZlbnRIYW5kbGVyczoge30sXG4gIF90cmlnZ2VyT25UaWxlc0xvYWRlZEV2ZW50OiB0cnVlLCAvL3doZXRoZXIgb3Igbm90IHRvIGZpcmUgdGhlIG9uVGlsZXNMb2FkZWQgZXZlbnQgd2hlbiBhbGwgb2YgdGhlIHRpbGVzIGZpbmlzaCBsb2FkaW5nLlxuICBfdXJsOiBcIlwiLCAvL2ludGVybmFsIFVSTCBwcm9wZXJ0eVxuXG4gIHN0eWxlOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgdmFyIHN0eWxlID0ge307XG5cbiAgICB2YXIgdHlwZSA9IGZlYXR1cmUudHlwZTtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgMTogLy8nUG9pbnQnXG4gICAgICAgIHN0eWxlLmNvbG9yID0gJ3JnYmEoNDksNzksNzksMSknO1xuICAgICAgICBzdHlsZS5yYWRpdXMgPSA1O1xuICAgICAgICBzdHlsZS5zZWxlY3RlZCA9IHtcbiAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LDI1NSwwLDAuNSknLFxuICAgICAgICAgIHJhZGl1czogNlxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjogLy8nTGluZVN0cmluZydcbiAgICAgICAgc3R5bGUuY29sb3IgPSAncmdiYSgxNjEsMjE3LDE1NSwwLjgpJztcbiAgICAgICAgc3R5bGUuc2l6ZSA9IDM7XG4gICAgICAgIHN0eWxlLnNlbGVjdGVkID0ge1xuICAgICAgICAgIGNvbG9yOiAncmdiYSgyNTUsMjUsMCwwLjUpJyxcbiAgICAgICAgICBzaXplOiA0XG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOiAvLydQb2x5Z29uJ1xuICAgICAgICBzdHlsZS5jb2xvciA9ICdyZ2JhKDQ5LDc5LDc5LDEpJztcbiAgICAgICAgc3R5bGUub3V0bGluZSA9IHtcbiAgICAgICAgICBjb2xvcjogJ3JnYmEoMTYxLDIxNywxNTUsMC44KScsXG4gICAgICAgICAgc2l6ZTogMVxuICAgICAgICB9O1xuICAgICAgICBzdHlsZS5zZWxlY3RlZCA9IHtcbiAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LDE0MCwwLDAuMyknLFxuICAgICAgICAgIG91dGxpbmU6IHtcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgyNTUsMTQwLDAsMSknLFxuICAgICAgICAgICAgc2l6ZTogMlxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBzdHlsZTtcbiAgfSxcblxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIC8vYSBsaXN0IG9mIHRoZSBsYXllcnMgY29udGFpbmVkIGluIHRoZSBQQkZzXG4gICAgdGhpcy5sYXllcnMgPSB7fTtcblxuICAgIC8vIHRpbGVzIGN1cnJlbnRseSBpbiB0aGUgdmlld3BvcnRcbiAgICB0aGlzLmFjdGl2ZVRpbGVzID0ge307XG5cbiAgICB0aGlzLl91cmwgPSB0aGlzLm9wdGlvbnMudXJsO1xuXG4gICAgLyoqXG4gICAgICogRm9yIHNvbWUgcmVhc29uLCBMZWFmbGV0IGhhcyBzb21lIGNvZGUgdGhhdCByZXNldHMgdGhlXG4gICAgICogeiBpbmRleCBpbiB0aGUgb3B0aW9ucyBvYmplY3QuIEknbSBoYXZpbmcgdHJvdWJsZSB0cmFja2luZ1xuICAgICAqIGRvd24gZXhhY3RseSB3aGF0IGRvZXMgdGhpcyBhbmQgd2h5LCBzbyBmb3Igbm93LCB3ZSBzaG91bGRcbiAgICAgKiBqdXN0IGNvcHkgdGhlIHZhbHVlIHRvIHRoaXMuekluZGV4IHNvIHdlIGNhbiBoYXZlIHRoZSByaWdodFxuICAgICAqIG51bWJlciB3aGVuIHdlIG1ha2UgdGhlIHN1YnNlcXVlbnQgTVZUTGF5ZXJzLlxuICAgICAqL1xuICAgIHRoaXMuekluZGV4ID0gb3B0aW9ucy56SW5kZXg7XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuc3R5bGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIG9wdGlvbnMuc3R5bGUgPT09ICdvYmplY3QnKSB7XG4gICAgICB0aGlzLnN0eWxlID0gb3B0aW9ucy5zdHlsZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuYWpheFNvdXJjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5hamF4U291cmNlID0gb3B0aW9ucy5hamF4U291cmNlO1xuICAgIH1cblxuICAgIHRoaXMubGF5ZXJMaW5rID0gb3B0aW9ucy5sYXllckxpbms7XG5cbiAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG5cbiAgICB0aGlzLl90aWxlc1RvUHJvY2VzcyA9IDA7IC8vc3RvcmUgdGhlIG1heCBudW1iZXIgb2YgdGlsZXMgdG8gYmUgbG9hZGVkLiAgTGF0ZXIsIHdlIGNhbiB1c2UgdGhpcyBjb3VudCB0byBjb3VudCBkb3duIFBCRiBsb2FkaW5nLlxuICB9LFxuXG4gIHJlZHJhdzogZnVuY3Rpb24odHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudCl7XG4gICAgLy9Pbmx5IHNldCB0byBmYWxzZSBpZiBpdCBhY3R1YWxseSBpcyBwYXNzZWQgaW4gYXMgJ2ZhbHNlJ1xuICAgIGlmICh0cmlnZ2VyT25UaWxlc0xvYWRlZEV2ZW50ID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5fdHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudCA9IGZhbHNlO1xuICAgIH1cblxuICAgIEwuVGlsZUxheWVyLkNhbnZhcy5wcm90b3R5cGUucmVkcmF3LmNhbGwodGhpcyk7XG4gIH0sXG5cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIEwuVGlsZUxheWVyLkNhbnZhcy5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgbWFwLm9uKCdjbGljaycsIHRoaXMuX29uQ2xpY2ssIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkhvdmVyKXtcbiAgICAgICAgbWFwLm9uKCdtb3VzZW1vdmUnLCB0aGlzLl9vbkhvdmVyLCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLmFkZENoaWxkTGF5ZXJzKG1hcCk7XG5cbiAgICBpZiAodHlwZW9mIER5bmFtaWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgIHRoaXMuZHluYW1pY0xhYmVsID0gbmV3IER5bmFtaWNMYWJlbChtYXAsIHRoaXMsIHt9KTtcbiAgICB9XG4gIH0sXG5cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgdGhpcy5yZW1vdmVDaGlsZExheWVycyhtYXApO1xuICAgIG1hcC5vZmYoJ2NsaWNrJywgdGhpcy5fb25DbGljaywgdGhpcyk7XG4gICAgTC5UaWxlTGF5ZXIuQ2FudmFzLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgdGhpcy5tYXAgPSBudWxsO1xuICB9LFxuXG4gIGRyYXdUaWxlOiBmdW5jdGlvbihjYW52YXMsIHRpbGVQb2ludCwgem9vbSkge1xuICAgIHZhciBjdHggPSB7XG4gICAgICBpZDogW3pvb20sIHRpbGVQb2ludC54LCB0aWxlUG9pbnQueV0uam9pbihcIjpcIiksXG4gICAgICBjYW52YXM6IGNhbnZhcyxcbiAgICAgIHRpbGU6IHRpbGVQb2ludCxcbiAgICAgIHpvb206IHpvb20sXG4gICAgICB0aWxlU2l6ZTogdGhpcy5vcHRpb25zLnRpbGVTaXplXG4gICAgfTtcblxuICAgIC8vQ2FwdHVyZSB0aGUgbWF4IG51bWJlciBvZiB0aGUgdGlsZXMgdG8gbG9hZCBoZXJlLiB0aGlzLl90aWxlc1RvUHJvY2VzcyBpcyBhbiBpbnRlcm5hbCBudW1iZXIgd2UgdXNlIHRvIGtub3cgd2hlbiB3ZSd2ZSBmaW5pc2hlZCByZXF1ZXN0aW5nIFBCRnMuXG4gICAgaWYodGhpcy5fdGlsZXNUb1Byb2Nlc3MgPCB0aGlzLl90aWxlc1RvTG9hZCkgdGhpcy5fdGlsZXNUb1Byb2Nlc3MgPSB0aGlzLl90aWxlc1RvTG9hZDtcblxuICAgIHZhciBpZCA9IGN0eC5pZCA9IFV0aWwuZ2V0Q29udGV4dElEKGN0eCk7XG4gICAgdGhpcy5hY3RpdmVUaWxlc1tpZF0gPSBjdHg7XG5cbiAgICBpZighdGhpcy5wcm9jZXNzZWRUaWxlc1tjdHguem9vbV0pIHRoaXMucHJvY2Vzc2VkVGlsZXNbY3R4Lnpvb21dID0ge307XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmRlYnVnKSB7XG4gICAgICB0aGlzLl9kcmF3RGVidWdJbmZvKGN0eCk7XG4gICAgfVxuICAgIHRoaXMuX2RyYXcoY3R4KTtcbiAgfSxcblxuICBzZXRPcGFjaXR5OmZ1bmN0aW9uKG9wYWNpdHkpIHtcbiAgICB0aGlzLl9zZXRWaXNpYmxlTGF5ZXJzU3R5bGUoJ29wYWNpdHknLG9wYWNpdHkpO1xuICB9LFxuXG4gIHNldFpJbmRleDpmdW5jdGlvbih6SW5kZXgpIHtcbiAgICB0aGlzLl9zZXRWaXNpYmxlTGF5ZXJzU3R5bGUoJ3pJbmRleCcsekluZGV4KTtcbiAgfSxcblxuICBfc2V0VmlzaWJsZUxheWVyc1N0eWxlOmZ1bmN0aW9uKHN0eWxlLCB2YWx1ZSkge1xuICAgIGZvcih2YXIga2V5IGluIHRoaXMubGF5ZXJzKSB7XG4gICAgICB0aGlzLmxheWVyc1trZXldLl90aWxlQ29udGFpbmVyLnN0eWxlW3N0eWxlXSA9IHZhbHVlO1xuICAgIH1cbiAgfSxcblxuICBfZHJhd0RlYnVnSW5mbzogZnVuY3Rpb24oY3R4KSB7XG4gICAgdmFyIG1heCA9IHRoaXMub3B0aW9ucy50aWxlU2l6ZTtcbiAgICB2YXIgZyA9IGN0eC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBnLnN0cm9rZVN0eWxlID0gJyMwMDAwMDAnO1xuICAgIGcuZmlsbFN0eWxlID0gJyNGRkZGMDAnO1xuICAgIGcuc3Ryb2tlUmVjdCgwLCAwLCBtYXgsIG1heCk7XG4gICAgZy5mb250ID0gXCIxMnB4IEFyaWFsXCI7XG4gICAgZy5maWxsUmVjdCgwLCAwLCA1LCA1KTtcbiAgICBnLmZpbGxSZWN0KDAsIG1heCAtIDUsIDUsIDUpO1xuICAgIGcuZmlsbFJlY3QobWF4IC0gNSwgMCwgNSwgNSk7XG4gICAgZy5maWxsUmVjdChtYXggLSA1LCBtYXggLSA1LCA1LCA1KTtcbiAgICBnLmZpbGxSZWN0KG1heCAvIDIgLSA1LCBtYXggLyAyIC0gNSwgMTAsIDEwKTtcbiAgICBnLnN0cm9rZVRleHQoY3R4Lnpvb20gKyAnICcgKyBjdHgudGlsZS54ICsgJyAnICsgY3R4LnRpbGUueSwgbWF4IC8gMiAtIDMwLCBtYXggLyAyIC0gMTApO1xuICB9LFxuXG4gIF9kcmF3OiBmdW5jdGlvbihjdHgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbi8vICAgIC8vVGhpcyB3b3JrcyB0byBza2lwIGZldGNoaW5nIGFuZCBwcm9jZXNzaW5nIHRpbGVzIGlmIHRoZXkndmUgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbi8vICAgIHZhciB2ZWN0b3JUaWxlID0gdGhpcy5wcm9jZXNzZWRUaWxlc1tjdHguem9vbV1bY3R4LmlkXTtcbi8vICAgIC8vaWYgd2UndmUgYWxyZWFkeSBwYXJzZWQgaXQsIGRvbid0IGdldCBpdCBhZ2Fpbi5cbi8vICAgIGlmKHZlY3RvclRpbGUpe1xuLy8gICAgICBjb25zb2xlLmxvZyhcIlNraXBwaW5nIGZldGNoaW5nIFwiICsgY3R4LmlkKTtcbi8vICAgICAgc2VsZi5jaGVja1ZlY3RvclRpbGVMYXllcnMocGFyc2VWVCh2ZWN0b3JUaWxlKSwgY3R4LCB0cnVlKTtcbi8vICAgICAgc2VsZi5yZWR1Y2VUaWxlc1RvUHJvY2Vzc0NvdW50KCk7XG4vLyAgICAgIHJldHVybjtcbi8vICAgIH1cblxuICAgIGlmICghdGhpcy5fdXJsKSByZXR1cm47XG4gICAgdmFyIHNyYyA9IHRoaXMuZ2V0VGlsZVVybCh7IHg6IGN0eC50aWxlLngsIHk6IGN0eC50aWxlLnksIHo6IGN0eC56b29tIH0pO1xuXG4gICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh4aHIuc3RhdHVzID09IFwiMjAwXCIpIHtcblxuICAgICAgICBpZigheGhyLnJlc3BvbnNlKSByZXR1cm47XG5cbiAgICAgICAgdmFyIGFycmF5QnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoeGhyLnJlc3BvbnNlKTtcbiAgICAgICAgdmFyIGJ1ZiA9IG5ldyBQcm90b2J1ZihhcnJheUJ1ZmZlcik7XG4gICAgICAgIHZhciB2dCA9IG5ldyBWZWN0b3JUaWxlKGJ1Zik7XG4gICAgICAgIC8vIENoZWNrIHRoZSBhdHRhY2htZW50IHN0YXR1cyBvZiB0aGUgbGF5ZXIuXG4gICAgICAgIGlmICghc2VsZi5tYXApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkZldGNoZWQgdGlsZSBmb3IgcmVtb3ZlZCBtYXAuXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBDaGVjayB0aGUgY3VycmVudCBtYXAgbGF5ZXIgem9vbS4gIElmIGZhc3Qgem9vbWluZyBpcyBvY2N1cnJpbmcsIHRoZW4gc2hvcnQgY2lyY3VpdCB0aWxlcyB0aGF0IGFyZSBmb3IgYSBkaWZmZXJlbnQgem9vbSBsZXZlbCB0aGFuIHdlJ3JlIGN1cnJlbnRseSBvbi5cbiAgICAgICAgaWYgKHNlbGYubWFwLmdldFpvb20oKSAhPSBjdHguem9vbSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiRmV0Y2hlZCB0aWxlIGZvciB6b29tIGxldmVsIFwiICsgY3R4Lnpvb20gKyBcIi4gTWFwIGlzIGF0IHpvb20gbGV2ZWwgXCIgKyBzZWxmLm1hcC5nZXRab29tKCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmNoZWNrVmVjdG9yVGlsZUxheWVycyhwYXJzZVZUKHZ0KSwgY3R4KTtcbiAgICAgIH1cblxuICAgICAgLy9laXRoZXIgd2F5LCByZWR1Y2UgdGhlIGNvdW50IG9mIHRpbGVzVG9Qcm9jZXNzIHRpbGVzIGhlcmVcbiAgICAgIHNlbGYucmVkdWNlVGlsZXNUb1Byb2Nlc3NDb3VudCgpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS5sb2coXCJ4aHIgZXJyb3I6IFwiICsgeGhyLnN0YXR1cylcbiAgICB9O1xuXG4gICAgeGhyLm9wZW4oJ0dFVCcsIHNyYywgdHJ1ZSk7IC8vYXN5bmMgaXMgdHJ1ZVxuICAgIHZhciBoZWFkZXJzID0gc2VsZi5vcHRpb25zLnhockhlYWRlcnM7XG4gICAgZm9yICh2YXIgaGVhZGVyIGluIGhlYWRlcnMpIHtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlciwgaGVhZGVyc1toZWFkZXJdKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgeGhyLnNlbmQoKTtcbiAgfSxcblxuICByZWR1Y2VUaWxlc1RvUHJvY2Vzc0NvdW50OiBmdW5jdGlvbigpe1xuICAgIHRoaXMuX3RpbGVzVG9Qcm9jZXNzLS07XG4gICAgaWYoIXRoaXMuX3RpbGVzVG9Qcm9jZXNzKXtcbiAgICAgIC8vVHJpZ2dlciBldmVudCBsZXR0aW5nIHVzIGtub3cgdGhhdCBhbGwgUEJGcyBoYXZlIGJlZW4gbG9hZGVkIGFuZCBwcm9jZXNzZWQgKG9yIDQwNCdkKS5cbiAgICAgIGlmKHRoaXMuX2V2ZW50SGFuZGxlcnNbXCJQQkZMb2FkXCJdKSB0aGlzLl9ldmVudEhhbmRsZXJzW1wiUEJGTG9hZFwiXSgpO1xuICAgICAgdGhpcy5fcGJmTG9hZGVkKCk7XG4gICAgfVxuICB9LFxuXG4gIGNoZWNrVmVjdG9yVGlsZUxheWVyczogZnVuY3Rpb24odnQsIGN0eCwgcGFyc2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy9DaGVjayBpZiB0aGVyZSBhcmUgc3BlY2lmaWVkIHZpc2libGUgbGF5ZXJzXG4gICAgdmFyIHZpc2libGVMYXllcnMgPSBzZWxmLm9wdGlvbnMudmlzaWJsZUxheWVycztcbiAgICBpZiAoIXZpc2libGVMYXllcnMpIHtcbiAgICAgIHZpc2libGVMYXllcnMgPSBPYmplY3Qua2V5cyh2dC5sYXllcnMpO1xuICAgIH1cblxuICAgIHZhciBsYXllck1hcHBpbmcgPSB2aXNpYmxlTGF5ZXJzO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZpc2libGVMYXllcnMpKSB7XG4gICAgICBsYXllck1hcHBpbmcgPSB7fTtcbiAgICAgIGZvciAodmFyIGk9MDsgaSA8IHZpc2libGVMYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGF5ZXJNYXBwaW5nW3Zpc2libGVMYXllcnNbaV1dID0gdmlzaWJsZUxheWVyc1tpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gbGF5ZXJNYXBwaW5nKSB7XG4gICAgICB2YXIgbHlyID0gdnQubGF5ZXJzW2xheWVyTWFwcGluZ1trZXldXTtcbiAgICAgIGlmIChseXIpIHtcbiAgICAgICAgc2VsZi5wcmVwYXJlTVZUTGF5ZXJzKGx5ciwga2V5LCBjdHgsIHBhcnNlZCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHByZXBhcmVNVlRMYXllcnM6IGZ1bmN0aW9uKGx5ciAsa2V5LCBjdHgsIHBhcnNlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICghc2VsZi5sYXllcnNba2V5XSkge1xuICAgICAgLy9DcmVhdGUgTVZUTGF5ZXIgb3IgTVZUUG9pbnRMYXllciBmb3IgdXNlclxuICAgICAgc2VsZi5sYXllcnNba2V5XSA9IHNlbGYuY3JlYXRlTVZUTGF5ZXIoa2V5LCBseXIucGFyc2VkRmVhdHVyZXNbMF0udHlwZSB8fCBudWxsKTtcbiAgICB9XG5cbiAgICBpZiAocGFyc2VkKSB7XG4gICAgICAvL1dlJ3ZlIGFscmVhZHkgcGFyc2VkIGl0LiAgR28gZ2V0IGNhbnZhcyBhbmQgZHJhdy5cbiAgICAgIHNlbGYubGF5ZXJzW2tleV0uZ2V0Q2FudmFzKGN0eCwgbHlyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5sYXllcnNba2V5XS5wYXJzZVZlY3RvclRpbGVMYXllcihseXIsIGN0eCk7XG4gICAgfVxuXG4gIH0sXG5cbiAgY3JlYXRlTVZUTGF5ZXI6IGZ1bmN0aW9uKGtleSwgdHlwZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBnZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICBpZiAodHlwZW9mIHNlbGYub3B0aW9ucy5nZXRJREZvckxheWVyRmVhdHVyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZ2V0SURGb3JMYXllckZlYXR1cmUgPSBzZWxmLm9wdGlvbnMuZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdldElERm9yTGF5ZXJGZWF0dXJlID0gVXRpbC5nZXRJREZvckxheWVyRmVhdHVyZTtcbiAgICB9XG5cbiAgICB2YXIgc3R5bGUgPSBzZWxmLnN0eWxlO1xuICAgIGlmICh0eXBlb2Ygc3R5bGUgPT09ICdvYmplY3QnKSB7XG4gICAgICBzdHlsZSA9IHN0eWxlW2tleV07XG4gICAgfVxuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICBnZXRJREZvckxheWVyRmVhdHVyZTogZ2V0SURGb3JMYXllckZlYXR1cmUsXG4gICAgICBmaWx0ZXI6IHNlbGYub3B0aW9ucy5maWx0ZXIsXG4gICAgICBsYXllck9yZGVyaW5nOiBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZyxcbiAgICAgIHN0eWxlOiBzdHlsZSxcbiAgICAgIG5hbWU6IGtleSxcbiAgICAgIGFzeW5jaDogdHJ1ZSxcbiAgICAgIGJ1ZmZlcjogc2VsZi5vcHRpb25zLmJ1ZmZlclxuICAgIH07XG5cbiAgICBpZiAoc2VsZi5vcHRpb25zLnpJbmRleCkge1xuICAgICAgb3B0aW9ucy56SW5kZXggPSBzZWxmLnpJbmRleDtcbiAgICB9XG5cbiAgICAvL1Rha2UgdGhlIGxheWVyIGFuZCBjcmVhdGUgYSBuZXcgTVZUTGF5ZXIgb3IgTVZUUG9pbnRMYXllciBpZiBvbmUgZG9lc24ndCBleGlzdC5cbiAgICB2YXIgbGF5ZXIgPSBuZXcgTVZUTGF5ZXIoc2VsZiwgb3B0aW9ucykuYWRkVG8oc2VsZi5tYXApO1xuXG4gICAgcmV0dXJuIGxheWVyO1xuICB9LFxuXG4gIGdldExheWVyczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubGF5ZXJzO1xuICB9LFxuXG4gIGhpZGVMYXllcjogZnVuY3Rpb24oaWQpIHtcbiAgICBpZiAodGhpcy5sYXllcnNbaWRdKSB7XG4gICAgICB0aGlzLl9tYXAucmVtb3ZlTGF5ZXIodGhpcy5sYXllcnNbaWRdKTtcbiAgICAgIHZhciB2aXNpYmxlTGF5ZXJzID0gdGhpcy5vcHRpb25zLnZpc2libGVMYXllcnM7XG4gICAgICBpZiAodmlzaWJsZUxheWVycykge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2aXNpYmxlTGF5ZXJzKSAmJiB2aXNpYmxlTGF5ZXJzLmluZGV4T2YoaWQpID4gLTEpIHtcbiAgICAgICAgICB2aXNpYmxlTGF5ZXJzLnNwbGljZSh2aXNpYmxlTGF5ZXJzLmluZGV4T2YoaWQpLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdmlzaWJsZUxheWVyc1tpZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2hvd0xheWVyOiBmdW5jdGlvbihpZCkge1xuICAgIGlmICh0aGlzLmxheWVyc1tpZF0pIHtcbiAgICAgIHRoaXMuX21hcC5hZGRMYXllcih0aGlzLmxheWVyc1tpZF0pO1xuICAgICAgdmFyIHZpc2libGVMYXllcnMgPSB0aGlzLm9wdGlvbnMudmlzaWJsZUxheWVycztcbiAgICAgIGlmICh2aXNpYmxlTGF5ZXJzKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZpc2libGVMYXllcnMpKSB7XG4gICAgICAgICAgdmlzaWJsZUxheWVycy5wdXNoKGlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2aXNpYmxlTGF5ZXJzW2lkXSA9IGlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vTWFrZSBzdXJlIG1hbmFnZXIgbGF5ZXIgaXMgYWx3YXlzIGluIGZyb250XG4gICAgdGhpcy5icmluZ1RvRnJvbnQoKTtcbiAgfSxcblxuICByZW1vdmVDaGlsZExheWVyczogZnVuY3Rpb24obWFwKXtcbiAgICAvL1JlbW92ZSBjaGlsZCBsYXllcnMgb2YgdGhpcyBncm91cCBsYXllclxuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmxheWVycykge1xuICAgICAgdmFyIGxheWVyID0gdGhpcy5sYXllcnNba2V5XTtcbiAgICAgIG1hcC5yZW1vdmVMYXllcihsYXllcik7XG4gICAgfVxuICB9LFxuXG4gIGFkZENoaWxkTGF5ZXJzOiBmdW5jdGlvbihtYXApIHtcbiAgICB2YXIgdmlzaWJsZUxheWVycyA9IHRoaXMudmlzaWJsZUxheWVycztcbiAgICBpZiAodmlzaWJsZUxheWVycykge1xuICAgICAgLy9vbmx5IGxldCB0aHJ1IHRoZSBsYXllcnMgbGlzdGVkIGluIHRoZSB2aXNpYmxlTGF5ZXJzIGFycmF5IG9yIG9iamVjdFxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZpc2libGVMYXllcnMpKSB7XG4gICAgICAgIHZpc2libGVMYXllcnMgPSBPYmplY3Qua2V5cyh2aXNpYmxlTGF5ZXJzKTtcbiAgICAgIH1cbiAgICAgIGZvcih2YXIgaT0wOyBpIDwgdmlzaWJsZUxheWVycy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHZhciBsYXllck5hbWUgPSB2aXNpYmxlTGF5ZXJzW2ldO1xuICAgICAgICB2YXIgbGF5ZXIgPSB0aGlzLmxheWVyc1tsYXllck5hbWVdO1xuICAgICAgICBpZihsYXllcil7XG4gICAgICAgICAgLy9Qcm9jZWVkIHdpdGggcGFyc2luZ1xuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIC8vQWRkIGFsbCBsYXllcnNcbiAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmxheWVycykge1xuICAgICAgICB2YXIgbGF5ZXIgPSB0aGlzLmxheWVyc1trZXldO1xuICAgICAgICAvLyBsYXllciBpcyBzZXQgdG8gdmlzaWJsZSBhbmQgaXMgbm90IGFscmVhZHkgb24gbWFwXG4gICAgICAgIGlmICghbGF5ZXIuX21hcCkge1xuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgYmluZDogZnVuY3Rpb24oZXZlbnRUeXBlLCBjYWxsYmFjaykge1xuICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRUeXBlXSA9IGNhbGxiYWNrO1xuICB9LFxuXG4gIGZlYXR1cmVBdExhdExuZzogZnVuY3Rpb24obGF0bG5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZmVhdHVyZUF0Q29udGFpbmVyUG9pbnQodGhpcy5tYXAubGF0TG5nVG9Db250YWluZXJQb2ludChsYXRsbmcpKTtcbiAgfSxcblxuICBmZWF0dXJlQXRDb250YWluZXJQb2ludDogZnVuY3Rpb24oY29udGFpbmVyUG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy5fZmVhdHVyZUF0KGNvbnRhaW5lclBvaW50LCB0aGlzLmxheWVycyk7XG4gIH0sXG5cbiAgX2ZlYXR1cmVBdDogZnVuY3Rpb24oY29udGFpbmVyUG9pbnQsIGxheWVycykge1xuICAgIHZhciB0aWxlUG9pbnQgPSB0aGlzLl9nZXRUaWxlUG9pbnQoY29udGFpbmVyUG9pbnQpO1xuXG4gICAgLy8gVE9ETzogWi1vcmRlcmluZz8gIENsaWNrYWJsZT9cbiAgICBmb3IgKHZhciBrZXkgaW4gbGF5ZXJzKSB7XG4gICAgICB2YXIgbGF5ZXIgPSBsYXllcnNba2V5XTtcbiAgICAgIHZhciBmZWF0dXJlID0gbGF5ZXIuZmVhdHVyZUF0KHRpbGVQb2ludC50aWxlSUQsIHRpbGVQb2ludCk7XG4gICAgICBpZiAoZmVhdHVyZSkge1xuICAgICAgICByZXR1cm4gZmVhdHVyZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgX29uSG92ZXI6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb25Ib3ZlciA9IHNlbGYub3B0aW9ucy5vbkhvdmVyO1xuICAgIGlmICh0eXBlb2Ygb25Ib3ZlciA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIG9uSG92ZXIoc2VsZiwgZXZ0KTtcbiAgICB9XG4gIH0sXG5cbiAgX29uQ2xpY2s6IGZ1bmN0aW9uKGV2dCkge1xuICAgIC8vSGVyZSwgcGFzcyB0aGUgZXZlbnQgb24gdG8gdGhlIGNoaWxkIE1WVExheWVyIGFuZCBoYXZlIGl0IGRvIHRoZSBoaXQgdGVzdCBhbmQgaGFuZGxlIHRoZSByZXN1bHQuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBvbkNsaWNrID0gc2VsZi5vcHRpb25zLm9uQ2xpY2s7XG4gICAgdmFyIGNsaWNrYWJsZUxheWVycyA9IHNlbGYub3B0aW9ucy5jbGlja2FibGVMYXllcnM7XG4gICAgdmFyIGxheWVycyA9IHNlbGYubGF5ZXJzO1xuXG4gICAgLy8gV2UgbXVzdCBoYXZlIGFuIGFycmF5IG9mIGNsaWNrYWJsZSBsYXllcnMsIG90aGVyd2lzZSwgd2UganVzdCBwYXNzXG4gICAgLy8gdGhlIGV2ZW50IHRvIHRoZSBwdWJsaWMgb25DbGljayBjYWxsYmFjayBpbiBvcHRpb25zLlxuICAgIGlmIChjbGlja2FibGVMYXllcnMpIHtcbiAgICAgIGxheWVycyA9IHt9O1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNsaWNrYWJsZUxheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2xpY2thYmxlTGF5ZXJzW2ldO1xuICAgICAgICB2YXIgbGF5ZXIgPSBzZWxmLmxheWVyc1trZXldO1xuICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICBsYXllcnNba2V5XSA9IGxheWVyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGZlYXR1cmUgPSB0aGlzLl9mZWF0dXJlQXQoZXZ0LmNvbnRhaW5lclBvaW50LCBsYXllcnMpO1xuICAgIGlmIChmZWF0dXJlICYmIGZlYXR1cmUudG9nZ2xlRW5hYmxlZCkge1xuICAgICAgZmVhdHVyZS50b2dnbGUoKTtcbiAgICB9XG5cbiAgICBldnQuZmVhdHVyZSA9IGZlYXR1cmU7XG4gICAgaWYgKHR5cGVvZiBvbkNsaWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBvbkNsaWNrKGV2dCk7XG4gICAgfVxuICB9LFxuXG4gIHNldEZpbHRlcjogZnVuY3Rpb24oZmlsdGVyRnVuY3Rpb24sIGxheWVyTmFtZSkge1xuICAgIC8vdGFrZSBpbiBhIG5ldyBmaWx0ZXIgZnVuY3Rpb24uXG4gICAgLy9Qcm9wYWdhdGUgdG8gY2hpbGQgbGF5ZXJzLlxuXG4gICAgLy9BZGQgZmlsdGVyIHRvIGFsbCBjaGlsZCBsYXllcnMgaWYgbm8gbGF5ZXIgaXMgc3BlY2lmaWVkLlxuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmxheWVycykge1xuICAgICAgdmFyIGxheWVyID0gdGhpcy5sYXllcnNba2V5XTtcblxuICAgICAgaWYgKGxheWVyTmFtZSl7XG4gICAgICAgIGlmKGtleS50b0xvd2VyQ2FzZSgpID09IGxheWVyTmFtZS50b0xvd2VyQ2FzZSgpKXtcbiAgICAgICAgICBsYXllci5vcHRpb25zLmZpbHRlciA9IGZpbHRlckZ1bmN0aW9uOyAvL0Fzc2lnbiBmaWx0ZXIgdG8gY2hpbGQgbGF5ZXIsIG9ubHkgaWYgbmFtZSBtYXRjaGVzXG4gICAgICAgICAgLy9BZnRlciBmaWx0ZXIgaXMgc2V0LCB0aGUgb2xkIGZlYXR1cmUgaGFzaGVzIGFyZSBpbnZhbGlkLiAgQ2xlYXIgdGhlbSBmb3IgbmV4dCBkcmF3LlxuICAgICAgICAgIGxheWVyLmNsZWFyTGF5ZXJGZWF0dXJlSGFzaCgpO1xuICAgICAgICAgIC8vbGF5ZXIuY2xlYXJUaWxlRmVhdHVyZUhhc2goKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZXtcbiAgICAgICAgbGF5ZXIub3B0aW9ucy5maWx0ZXIgPSBmaWx0ZXJGdW5jdGlvbjsgLy9Bc3NpZ24gZmlsdGVyIHRvIGNoaWxkIGxheWVyXG4gICAgICAgIC8vQWZ0ZXIgZmlsdGVyIGlzIHNldCwgdGhlIG9sZCBmZWF0dXJlIGhhc2hlcyBhcmUgaW52YWxpZC4gIENsZWFyIHRoZW0gZm9yIG5leHQgZHJhdy5cbiAgICAgICAgbGF5ZXIuY2xlYXJMYXllckZlYXR1cmVIYXNoKCk7XG4gICAgICAgIC8vbGF5ZXIuY2xlYXJUaWxlRmVhdHVyZUhhc2goKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRha2UgaW4gYSBuZXcgc3R5bGUgZnVuY3Rpb24gYW5kIHByb3BvZ2F0ZSB0byBjaGlsZCBsYXllcnMuXG4gICAqIElmIHlvdSBkbyBub3Qgc2V0IGEgbGF5ZXIgbmFtZSwgaXQgcmVzZXRzIHRoZSBzdHlsZSBmb3IgYWxsIG9mIHRoZSBsYXllcnMuXG4gICAqIEBwYXJhbSBzdHlsZUZ1bmN0aW9uXG4gICAqIEBwYXJhbSBsYXllck5hbWVcbiAgICovXG4gIHNldFN0eWxlOiBmdW5jdGlvbihzdHlsZUZuLCBsYXllck5hbWUpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5sYXllcnMpIHtcbiAgICAgIHZhciBsYXllciA9IHRoaXMubGF5ZXJzW2tleV07XG4gICAgICBpZiAobGF5ZXJOYW1lKSB7XG4gICAgICAgIGlmKGtleS50b0xvd2VyQ2FzZSgpID09IGxheWVyTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgbGF5ZXIuc2V0U3R5bGUoc3R5bGVGbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxheWVyLnNldFN0eWxlKHN0eWxlRm4pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBmZWF0dXJlU2VsZWN0ZWQ6IGZ1bmN0aW9uKG12dEZlYXR1cmUpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLm11dGV4VG9nZ2xlKSB7XG4gICAgICBpZiAodGhpcy5fc2VsZWN0ZWRGZWF0dXJlKSB7XG4gICAgICAgIHRoaXMuX3NlbGVjdGVkRmVhdHVyZS5kZXNlbGVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fc2VsZWN0ZWRGZWF0dXJlID0gbXZ0RmVhdHVyZTtcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vblNlbGVjdCkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uU2VsZWN0KG12dEZlYXR1cmUpO1xuICAgIH1cbiAgfSxcblxuICBmZWF0dXJlRGVzZWxlY3RlZDogZnVuY3Rpb24obXZ0RmVhdHVyZSkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMubXV0ZXhUb2dnbGUgJiYgdGhpcy5fc2VsZWN0ZWRGZWF0dXJlKSB7XG4gICAgICB0aGlzLl9zZWxlY3RlZEZlYXR1cmUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uRGVzZWxlY3QpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkRlc2VsZWN0KG12dEZlYXR1cmUpO1xuICAgIH1cbiAgfSxcblxuICBfcGJmTG9hZGVkOiBmdW5jdGlvbigpIHtcbiAgICAvL0ZpcmVzIHdoZW4gYWxsIHRpbGVzIGZyb20gdGhpcyBsYXllciBoYXZlIGJlZW4gbG9hZGVkIGFuZCBkcmF3biAob3IgNDA0J2QpLlxuXG4gICAgLy9NYWtlIHN1cmUgbWFuYWdlciBsYXllciBpcyBhbHdheXMgaW4gZnJvbnRcbiAgICB0aGlzLmJyaW5nVG9Gcm9udCgpO1xuXG4gICAgLy9TZWUgaWYgdGhlcmUgaXMgYW4gZXZlbnQgdG8gZXhlY3V0ZVxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb25UaWxlc0xvYWRlZCA9IHNlbGYub3B0aW9ucy5vblRpbGVzTG9hZGVkO1xuXG4gICAgaWYgKG9uVGlsZXNMb2FkZWQgJiYgdHlwZW9mIG9uVGlsZXNMb2FkZWQgPT09ICdmdW5jdGlvbicgJiYgdGhpcy5fdHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudCA9PT0gdHJ1ZSkge1xuICAgICAgb25UaWxlc0xvYWRlZCh0aGlzKTtcbiAgICB9XG4gICAgc2VsZi5fdHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudCA9IHRydWU7IC8vcmVzZXQgLSBpZiByZWRyYXcoKSBpcyBjYWxsZWQgd2l0aCB0aGUgb3B0aW5hbCAnZmFsc2UnIHBhcmFtZXRlciB0byB0ZW1wb3JhcmlseSBkaXNhYmxlIHRoZSBvblRpbGVzTG9hZGVkIGV2ZW50IGZyb20gZmlyaW5nLiAgVGhpcyByZXNldHMgaXQgYmFjayB0byB0cnVlIGFmdGVyIGEgc2luZ2xlIHRpbWUgb2YgZmlyaW5nIGFzICdmYWxzZScuXG4gIH0sXG5cbiAgX2dldFRpbGVQb2ludDogZnVuY3Rpb24oY29udGFpbmVyUG9pbnQpIHtcbiAgICB2YXIgdGlsZVNpemUgPSB0aGlzLm9wdGlvbnMudGlsZVNpemU7XG4gICAgdmFyIGdsb2JhbFBvaW50ID0gdGhpcy5tYXAuY29udGFpbmVyUG9pbnRUb0xheWVyUG9pbnQoY29udGFpbmVyUG9pbnQpXG4gICAgICAuYWRkKHRoaXMubWFwLmdldFBpeGVsT3JpZ2luKCkpO1xuXG4gICAgdmFyIHRpbGVJbmRleFBvaW50ID0gZ2xvYmFsUG9pbnQuZGl2aWRlQnkodGlsZVNpemUpLmZsb29yKCk7XG4gICAgdmFyIHRpbGVQb2ludCA9IGdsb2JhbFBvaW50LnN1YnRyYWN0KHRpbGVJbmRleFBvaW50Lm11bHRpcGx5QnkodGlsZVNpemUpKTtcbiAgICB0aWxlUG9pbnQudGlsZUlEID0gXCJcIiArIHRoaXMubWFwLmdldFpvb20oKSArIFwiOlwiICsgdGlsZUluZGV4UG9pbnQueCArIFwiOlwiICsgdGlsZUluZGV4UG9pbnQueTtcbiAgICByZXR1cm4gdGlsZVBvaW50O1xuICB9XG5cbn0pO1xuXG5cbmlmICh0eXBlb2YoTnVtYmVyLnByb3RvdHlwZS50b1JhZCkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgTnVtYmVyLnByb3RvdHlwZS50b1JhZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzICogTWF0aC5QSSAvIDE4MDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZVZUKHZ0KXtcbiAgZm9yICh2YXIga2V5IGluIHZ0LmxheWVycykge1xuICAgIHZhciBseXIgPSB2dC5sYXllcnNba2V5XTtcbiAgICBwYXJzZVZURmVhdHVyZXMobHlyKTtcbiAgfVxuICByZXR1cm4gdnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlVlRGZWF0dXJlcyh2dGwpe1xuICB2dGwucGFyc2VkRmVhdHVyZXMgPSBbXTtcbiAgdmFyIGZlYXR1cmVzID0gdnRsLl9mZWF0dXJlcztcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIHZ0ZiA9IHZ0bC5mZWF0dXJlKGkpO1xuICAgIHZ0Zi5jb29yZGluYXRlcyA9IHZ0Zi5sb2FkR2VvbWV0cnkoKTtcbiAgICB2dGwucGFyc2VkRmVhdHVyZXMucHVzaCh2dGYpO1xuICB9XG4gIHJldHVybiB2dGw7XG59XG4iLCIvKipcbiAqIENyZWF0ZWQgYnkgTmljaG9sYXMgSGFsbGFoYW4gPG5oYWxsYWhhbkBzcGF0aWFsZGV2LmNvbT5cbiAqICAgICAgIG9uIDgvMTUvMTQuXG4gKi9cbnZhciBVdGlsID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuVXRpbC5nZXRDb250ZXh0SUQgPSBmdW5jdGlvbihjdHgpIHtcbiAgcmV0dXJuIFtjdHguem9vbSwgY3R4LnRpbGUueCwgY3R4LnRpbGUueV0uam9pbihcIjpcIik7XG59O1xuXG4vKipcbiAqIERlZmF1bHQgZnVuY3Rpb24gdGhhdCBnZXRzIHRoZSBpZCBmb3IgYSBsYXllciBmZWF0dXJlLlxuICogU29tZXRpbWVzIHRoaXMgbmVlZHMgdG8gYmUgZG9uZSBpbiBhIGRpZmZlcmVudCB3YXkgYW5kXG4gKiBjYW4gYmUgc3BlY2lmaWVkIGJ5IHRoZSB1c2VyIGluIHRoZSBvcHRpb25zIGZvciBMLlRpbGVMYXllci5NVlRTb3VyY2UuXG4gKlxuICogQHBhcmFtIGZlYXR1cmVcbiAqIEByZXR1cm5zIHtjdHguaWR8KnxpZHxzdHJpbmd8anN0cy5pbmRleC5jaGFpbi5Nb25vdG9uZUNoYWluLmlkfG51bWJlcn1cbiAqL1xuVXRpbC5nZXRJREZvckxheWVyRmVhdHVyZSA9IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5pZDtcbn07XG5cblV0aWwuZ2V0SlNPTiA9IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2spIHtcbiAgdmFyIHhtbGh0dHAgPSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnID8gbmV3IFhNTEh0dHBSZXF1ZXN0KCkgOiBuZXcgQWN0aXZlWE9iamVjdCgnTWljcm9zb2Z0LlhNTEhUVFAnKTtcbiAgeG1saHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhdHVzID0geG1saHR0cC5zdGF0dXM7XG4gICAgaWYgKHhtbGh0dHAucmVhZHlTdGF0ZSA9PT0gNCAmJiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkge1xuICAgICAgdmFyIGpzb24gPSBKU09OLnBhcnNlKHhtbGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGpzb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayggeyBlcnJvcjogdHJ1ZSwgc3RhdHVzOiBzdGF0dXMgfSApO1xuICAgIH1cbiAgfTtcbiAgeG1saHR0cC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gIHhtbGh0dHAuc2VuZCgpO1xufTtcbiIsIi8qKlxuICogQ3JlYXRlZCBieSBOaWNob2xhcyBIYWxsYWhhbiA8bmhhbGxhaGFuQHNwYXRpYWxkZXYuY29tPlxuICogICAgICAgb24gNy8zMS8xNC5cbiAqL1xudmFyIFV0aWwgPSByZXF1aXJlKCcuLi9NVlRVdGlsJyk7XG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRpY0xhYmVsO1xuXG5mdW5jdGlvbiBTdGF0aWNMYWJlbChtdnRGZWF0dXJlLCBjdHgsIGxhdExuZywgc3R5bGUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLm12dEZlYXR1cmUgPSBtdnRGZWF0dXJlO1xuICB0aGlzLm1hcCA9IG12dEZlYXR1cmUubWFwO1xuICB0aGlzLnpvb20gPSBjdHguem9vbTtcbiAgdGhpcy5sYXRMbmcgPSBsYXRMbmc7XG4gIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcblxuICBpZiAobXZ0RmVhdHVyZS5saW5rZWRGZWF0dXJlKSB7XG4gICAgdmFyIGxpbmtlZEZlYXR1cmUgPSBtdnRGZWF0dXJlLmxpbmtlZEZlYXR1cmUoKTtcbiAgICBpZiAobGlua2VkRmVhdHVyZSAmJiBsaW5rZWRGZWF0dXJlLnNlbGVjdGVkKSB7XG4gICAgICBzZWxmLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpbml0KHNlbGYsIG12dEZlYXR1cmUsIGN0eCwgbGF0TG5nLCBzdHlsZSlcbn1cblxuZnVuY3Rpb24gaW5pdChzZWxmLCBtdnRGZWF0dXJlLCBjdHgsIGxhdExuZywgc3R5bGUpIHtcbiAgdmFyIGFqYXhEYXRhID0gbXZ0RmVhdHVyZS5hamF4RGF0YTtcbiAgdmFyIHN0eSA9IHNlbGYuc3R5bGUgPSBzdHlsZS5zdGF0aWNMYWJlbChtdnRGZWF0dXJlLCBhamF4RGF0YSk7XG4gIHZhciBpY29uID0gc2VsZi5pY29uID0gTC5kaXZJY29uKHtcbiAgICBjbGFzc05hbWU6IHN0eS5jc3NDbGFzcyB8fCAnbGFiZWwtaWNvbi10ZXh0JyxcbiAgICBodG1sOiBzdHkuaHRtbCxcbiAgICBpY29uU2l6ZTogc3R5Lmljb25TaXplIHx8IFs1MCw1MF1cbiAgfSk7XG5cbiAgc2VsZi5tYXJrZXIgPSBMLm1hcmtlcihsYXRMbmcsIHtpY29uOiBpY29ufSkuYWRkVG8oc2VsZi5tYXApO1xuXG4gIGlmIChzZWxmLnNlbGVjdGVkKSB7XG4gICAgc2VsZi5tYXJrZXIuX2ljb24uY2xhc3NMaXN0LmFkZChzZWxmLnN0eWxlLmNzc1NlbGVjdGVkQ2xhc3MgfHwgJ2xhYmVsLWljb24tdGV4dC1zZWxlY3RlZCcpO1xuICB9XG5cbiAgc2VsZi5tYXJrZXIub24oJ2NsaWNrJywgc2VsZi50b2dnbGUsIHNlbGYpO1xuXG4gIHNlbGYubWFwLm9uKCd6b29tZW5kJywgdGhpcy5fb25ab29tRW5kLCB0aGlzKTtcbn1cblxuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLnNlbGVjdGVkKSB7XG4gICAgdGhpcy5kZXNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc2VsZWN0KCk7XG4gIH1cbn07XG5cblN0YXRpY0xhYmVsLnByb3RvdHlwZS5zZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IHRydWU7XG4gIHRoaXMubWFya2VyLl9pY29uLmNsYXNzTGlzdC5hZGQodGhpcy5zdHlsZS5jc3NTZWxlY3RlZENsYXNzIHx8ICdsYWJlbC1pY29uLXRleHQtc2VsZWN0ZWQnKTtcbiAgdmFyIGxpbmtlZEZlYXR1cmUgPSB0aGlzLm12dEZlYXR1cmUubGlua2VkRmVhdHVyZSgpO1xuICBpZiAoIWxpbmtlZEZlYXR1cmUuc2VsZWN0ZWQpIGxpbmtlZEZlYXR1cmUuc2VsZWN0KCk7XG59O1xuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUuZGVzZWxlY3QgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuICB0aGlzLm1hcmtlci5faWNvbi5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuc3R5bGUuY3NzU2VsZWN0ZWRDbGFzcyB8fCAnbGFiZWwtaWNvbi10ZXh0LXNlbGVjdGVkJyk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gdGhpcy5tdnRGZWF0dXJlLmxpbmtlZEZlYXR1cmUoKTtcbiAgaWYgKGxpbmtlZEZlYXR1cmUuc2VsZWN0ZWQpIGxpbmtlZEZlYXR1cmUuZGVzZWxlY3QoKTtcbn07XG5cblN0YXRpY0xhYmVsLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLm1hcCB8fCAhdGhpcy5tYXJrZXIpIHJldHVybjtcbiAgdGhpcy5tYXAub2ZmKCd6b29tZW5kJywgdGhpcy5fb25ab29tRW5kLCB0aGlzKTtcbiAgdGhpcy5tYXAucmVtb3ZlTGF5ZXIodGhpcy5tYXJrZXIpO1xufTtcblxuU3RhdGljTGFiZWwucHJvdG90eXBlLl9vblpvb21FbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5ld1pvb20gPSBlLnRhcmdldC5nZXRab29tKCk7XG4gIGlmICh0aGlzLnpvb20gIT09IG5ld1pvb20pIHtcbiAgICB0aGlzLnJlbW92ZSgpO1xuICB9XG59XG4iLCIvKlxuICogTC5Db250cm9sLkxheWVycyBpcyBhIGNvbnRyb2wgdG8gYWxsb3cgdXNlcnMgdG8gc3dpdGNoIGJldHdlZW4gZGlmZmVyZW50IGxheWVycyBvbiB0aGUgbWFwLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gTC5Db250cm9sLk1WVExheWVycyA9IEwuQ29udHJvbC5MYXllcnMuZXh0ZW5kKHtcblxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiAoYmFzZUxheWVycywgb3ZlcmxheXMsIG9wdGlvbnMpIHtcblx0XHRMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAgICAgLy8gTWFwIGZyb20gdmVjdG9yIGxheWVyIG5hbWUgdG8gcHJlc2VudGVkIG5hbWUgaW4gdG9nZ2xlXG4gICAgICAgIHRoaXMuX2xheWVyTmFtZXMgPSB0aGlzLm9wdGlvbnMubGF5ZXJOYW1lcyB8fCB7fTtcblx0XHR0aGlzLl9sYXllcnMgPSB7fTtcblx0XHR0aGlzLl9sYXN0WkluZGV4ID0gMDtcblx0XHR0aGlzLl9oYW5kbGluZ0NsaWNrID0gZmFsc2U7XG5cblx0XHRmb3IgKHZhciBpIGluIGJhc2VMYXllcnMpIHtcblx0XHRcdHRoaXMuYWRkQmFzZUxheWVyKGJhc2VMYXllcnNbaV0sIGkpO1xuXHRcdH1cblxuXHRcdGZvciAoaSBpbiBvdmVybGF5cykge1xuXHRcdFx0dGhpcy5hZGRNVlRMYXllcihvdmVybGF5c1tpXSwgaSk7XG5cdFx0fVxuXHR9LFxuXG5cdGFkZE1WVExheWVyOiBmdW5jdGlvbiAobGF5ZXIsIG5hbWUpIHtcblxuICAgICAgICB2YXIgb25UaWxlTG9hZCA9IGZ1bmN0aW9uKG12dFNyYyl7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbXZ0U3JjLmdldExheWVycygpKXtcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IHRoaXMuX2xheWVyTmFtZXNba2V5XSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRPdmVybGF5KG12dFNyYy5sYXllcnNba2V5XSwgbmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl91cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5vcHRpb25zLm9uVGlsZXNMb2FkZWQgPSBvblRpbGVMb2FkLmJpbmQodGhpcyk7XG5cdFx0cmV0dXJuIHRoaXMuX3VwZGF0ZSgpO1xuXHR9LFxuXG5cdF9vbklucHV0Q2xpY2s6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgaW5wdXRzID0gdGhpcy5fZm9ybS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKSxcblx0XHQgICAgaW5wdXQsIGxheWVyLCBoYXNMYXllcjtcblx0XHR2YXIgYWRkZWRMYXllcnMgPSBbXSxcblx0XHQgICAgcmVtb3ZlZExheWVycyA9IFtdO1xuXG5cdFx0dGhpcy5faGFuZGxpbmdDbGljayA9IHRydWU7XG5cblx0XHRmb3IgKHZhciBpID0gaW5wdXRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRpbnB1dCA9IGlucHV0c1tpXTtcblx0XHRcdGxheWVyID0gdGhpcy5fbGF5ZXJzW2lucHV0LmxheWVySWRdLmxheWVyO1xuXHRcdFx0aGFzTGF5ZXIgPSB0aGlzLl9tYXAuaGFzTGF5ZXIobGF5ZXIpO1xuXG5cdFx0XHRpZiAoaW5wdXQuY2hlY2tlZCAmJiAhaGFzTGF5ZXIpIHtcblx0XHRcdFx0YWRkZWRMYXllcnMucHVzaChsYXllcik7XG5cblx0XHRcdH0gZWxzZSBpZiAoIWlucHV0LmNoZWNrZWQgJiYgaGFzTGF5ZXIpIHtcblx0XHRcdFx0cmVtb3ZlZExheWVycy5wdXNoKGxheWVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBCdWdmaXggaXNzdWUgMjMxODogU2hvdWxkIHJlbW92ZSBhbGwgb2xkIGxheWVycyBiZWZvcmUgcmVhZGRpbmcgbmV3IG9uZXNcblx0XHRmb3IgKGkgPSAwOyBpIDwgcmVtb3ZlZExheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJsID0gcmVtb3ZlZExheWVyc1tpXTtcblxuICAgICAgICAgICAgLy8gSWYgd2UncmUgcmVtb3ZpbmcgYSB2ZWN0b3IgbGF5ZXJcbiAgICAgICAgICAgIGlmIChybC5tdnRTb3VyY2Upe1xuICAgICAgICAgICAgICAgIHJsLm12dFNvdXJjZS5oaWRlTGF5ZXIocmwubmFtZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hcC5yZW1vdmVMYXllcihyZW1vdmVkTGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIH1cblx0XHR9XG5cdFx0Zm9yIChpID0gMDsgaSA8IGFkZGVkTGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgYWwgPSBhZGRlZExheWVyc1tpXTtcblxuICAgICAgICAgICAgLy8gSWYgd2UncmUgYWRkaW5nIGEgdmVjdG9yIGxheWVyXG4gICAgICAgICAgICBpZiAoYWwubXZ0U291cmNlKXtcbiAgICAgICAgICAgICAgICBhbC5tdnRTb3VyY2Uuc2hvd0xheWVyKGFsLm5hbWUpO1xuICAgICAgICAgICAgICAgIGFsLm12dFNvdXJjZS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWFwLmFkZExheWVyKGFkZGVkTGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIH1cblx0XHR9XG5cblx0XHR0aGlzLl9oYW5kbGluZ0NsaWNrID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVmb2N1c09uTWFwKCk7XG5cdH0sXG59KTtcblxuTC5jb250cm9sLm12dExheWVycyA9IGZ1bmN0aW9uIChiYXNlTGF5ZXJzLCBvdmVybGF5cywgb3B0aW9ucykge1xuXHRyZXR1cm4gbmV3IEwuQ29udHJvbC5NVlRMYXllcnMoYmFzZUxheWVycywgb3ZlcmxheXMsIG9wdGlvbnMpO1xufTtcblxuTC5Eb21VdGlsLmVtcHR5ID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgd2hpbGUgKGVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgZWwucmVtb3ZlQ2hpbGQoZWwuZmlyc3RDaGlsZCk7XG4gICAgfVxufTtcblxuXG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgU3BhdGlhbCBEZXZlbG9wbWVudCBJbnRlcm5hdGlvbmFsXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFNvdXJjZSBjb2RlIGNhbiBiZSBmb3VuZCBhdDpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9TcGF0aWFsU2VydmVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZVxuICpcbiAqIEBsaWNlbnNlIElTQ1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0ge307XG5tb2R1bGUuZXhwb3J0cy5NVlRTb3VyY2UgPSByZXF1aXJlKCcuL01WVFNvdXJjZScpO1xubW9kdWxlLmV4cG9ydHMuQ29udHJvbCA9IHtcbiAgICBNVlRMYXllcnM6IHJlcXVpcmUoXCIuL2NvbnRyb2wvQ29udHJvbC5NVlRMYXllcnNcIilcbn07XG4iXX0=
