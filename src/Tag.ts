import ValueRepresentation from "./ValueRepresentation"
import DicomMessage from "./Message"
import {
  WriteBufferStream
} from './BufferStream';

const IMPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2";
const EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";

function paddingLeft(paddingValue, string) {
   return String(paddingValue + string).slice(-paddingValue.length);
}

export default class Tag {
  value: number;
    constructor(value) {
      this.value = value;
    };

    toString() {
      return "(" + paddingLeft("0000", this.group().toString(16).toUpperCase()) + "," +
             paddingLeft("0000", this.element().toString(16).toUpperCase()) + ")";
    }

    toCleanString() {
      return paddingLeft("0000", this.group().toString(16).toUpperCase()) +
             paddingLeft("0000", this.element().toString(16).toUpperCase());
    }

    is(t) {
      return this.value == t;
    }

    group() {
      return this.value >>> 16;
    }

    element() {
      return this.value & 0xffff;
    }

    isPixelDataTag() {
      return this.is(0x7fe00010);
    }

    static fromString(str) {
        var group = parseInt(str.substring(0,4), 16),
            element = parseInt(str.substring(4), 16);
        return Tag.fromNumbers(group, element);
    }

    static fromPString(str) {
        var group = parseInt(str.substring(1,5), 16),
            element = parseInt(str.substring(6,10), 16);
        return Tag.fromNumbers(group, element);
    }

    static fromNumbers(group, element) {
      return new Tag(((group << 16) | element) >>> 0);
    }

    static readTag(stream) {
      var group = stream.readUint16(), element = stream.readUint16();
      return Tag.fromNumbers(group, element);
    }

    write(
      stream: WriteBufferStream,
      vrType: string,
      values: Array<string>,
      syntax: string
    ) {
      var vr = ValueRepresentation.createByTypeString(vrType),
          useSyntax = DicomMessage._normalizeSyntax(syntax);

      var implicit = useSyntax == IMPLICIT_LITTLE_ENDIAN ? true : false,
          isLittleEndian = (useSyntax == IMPLICIT_LITTLE_ENDIAN || useSyntax == EXPLICIT_LITTLE_ENDIAN) ? true : false,
          isEncapsulated = DicomMessage.isEncapsulated(syntax);

      var oldEndian = stream.isLittleEndian;
      stream.setEndian(isLittleEndian);

      stream.writeUint16(this.group());
      stream.writeUint16(this.element());

      var tagStream = new WriteBufferStream(256), valueLength;
      tagStream.setEndian(isLittleEndian);

      if (vrType == 'OW' || vrType == 'OB') {
        valueLength = vr.writeBytes(tagStream, values, useSyntax, isEncapsulated);
      } else {
        valueLength = vr.writeBytes(tagStream, values, useSyntax);
      }

      if (vrType == "SQ") {
        valueLength = 0xffffffff;
      }
      var written = tagStream.size + 4;

      if (implicit) {
        stream.writeUint32(valueLength);
        written += 4;
      } else {
        if (vr.isExplicit()) {
          stream.writeString(vr.type);
          stream.writeHex("0000");
          stream.writeUint32(valueLength);
          written += 8;
        } else {
          stream.writeString(vr.type);
          stream.writeUint16(valueLength);
          written += 4;
        }
      }
      if (this.isPixelDataTag()) {
        console.log('write stream :' + tagStream.getBuffer().byteLength);
        console.log('value length: ' + valueLength);
        console.log('values :' + values );
      }
      stream.concat(tagStream);

      stream.setEndian(oldEndian);

      return written;
    }
}
