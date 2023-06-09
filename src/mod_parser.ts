
class BinaryReader {
    pos = 0;
    uint8array: Uint8Array;
    int8array: Int8Array;
    dataView: DataView;
    textdecoder: TextDecoder;

    constructor(private arraybuffer: ArrayBuffer) {
        this.dataView = new DataView(arraybuffer);
        this.textdecoder = new TextDecoder("ascii");
        this.uint8array = new Uint8Array(arraybuffer);
        this.int8array = new Int8Array(arraybuffer);
    }

    read_u8() {
        return this.dataView.getUint8(this.pos++);
    }

    read_i8_bytes(count: number) {
        const values = Array.from(this.int8array.slice(this.pos, this.pos + count));
        this.pos += count;
        return values;
    }

    read_u16() {
        const value = this.dataView.getUint16(this.pos, false);
        this.pos += 2;
        return value;
    }

    read_str(count: number) {
        const text = this.textdecoder.decode(this.arraybuffer.slice(this.pos, this.pos + count))
        this.pos += count;
        return text;
    }

    read_bytes(count: number) {
        const values = Array.from(this.uint8array.slice(this.pos, this.pos + count));
        this.pos += count;
        return values;
    }
}

const range = (len: number) => [...Array(len).keys()];

export async function read_mod() {
    const response = await fetch("GSLINGER.MOD");
    const br = new BinaryReader(await response.arrayBuffer());

    const songname = br.read_str(20);
    const instruments = range(31).map(() => {
        const name = br.read_str(22);
        const len = br.read_u16() * 2;
        const finetune = br.read_u8();
        const volume = br.read_u8();
        const repeat_point = br.read_u16() * 2;
        const repeat_length = br.read_u16() * 2;
        return { name, len, finetune, volume, repeat_point, repeat_length };
    });

    const songlength = br.read_u8();
    const deprecated = br.read_u8();
    const song_positions = br.read_bytes(128);
    const highest_pattern_number = song_positions.reduce((acc, cur) => cur > acc ? cur : acc, 0);
    const mahoney_kaktus_marker = br.read_str(4);

    const patterns = range(highest_pattern_number+1).map(pattern_no => range(64).map(row_no => range(4).map(channel_no => {
        /*
        Info for each note:

        _____byte 1_____   byte2_    _____byte 3_____   byte4_
        /                \ /      \  /                \ /      \
        0000          0000-00000000  0000          0000-00000000

        Upper four    12 bits for    Lower four    Effect command.
        bits of sam-  note period.   bits of sam-
        ple number.                  ple number.
        */

        const [b1, b2, b3, b4] = br.read_bytes(4);
        const sample_number = (b1 & 0xF0) | (b3 >> 4);
        const period = ((b1 & 0x0F) << 8) | b2;
        const effect = ((b3 & 0x0F) << 8) | b4;

        return { sample_number, period, effect };
    })));

    const instruments_with_samples = instruments.map((s, i) => {
        const data = br.read_i8_bytes(s.len);        
        const sample_data = new Float32Array(data.map(b => b / 128));

        return { ...s, sample_data };
    });

    console.log("MOD Info:");
    console.log("Songname:", songname);
    console.log("Samples:");
    instruments.forEach((s, i) => console.log("Sample", i, "Name:", s.name, "Len:", s.len, "Finetune:", s.finetune, "Volume:", s.volume, "Repeat point:", s.repeat_point, "Repeat len:", s.repeat_length));
    console.log("Song length:", songlength);
    console.log("Deprecated (127):", deprecated);
    console.log("Song positions:", song_positions);
    console.log("Mahoney-Kaktus marker:", mahoney_kaktus_marker);
    console.log("Higest pattern number:", highest_pattern_number);
    console.log("Patterns:", patterns);

    return {
        songname,
        songlength,
        song_positions,
        patterns,
        instruments_with_samples
    };
};