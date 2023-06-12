import { read_mod } from "./mod_parser";

console.clear();

type Instrument = {
    repeat_point: number;
    repeat_length: number;
    sample_data: Float32Array;
    finetune: number;
};

class Channel {
    volume_slide: number = 0;

    private gainNode: GainNode;
    private paulaNode: AudioWorkletNode;
    private current_instrument: Instrument | null = null;

    constructor(node: AudioNode) {
        this.gainNode = node.context.createGain();
        this.gainNode.connect(node);

        this.paulaNode = new AudioWorkletNode(node.context, "paula_processor");
        this.paulaNode.connect(this.gainNode);
    }

    public setVolume(value: number) {
        this.gainNode.gain.value = value;
    }

    public setInstrument(instrument: Instrument) {
        if (this.current_instrument === instrument) return;

        this.paulaNode.port.postMessage({
            kind: "sample_data",
            sample_data: instrument.sample_data,
        });
        this.paulaNode.parameters.get("loopStart")!.value = instrument.repeat_point;
        this.paulaNode.parameters.get("loopEnd")!.value =
            instrument.repeat_length > 2
                ? instrument.repeat_point + instrument.repeat_length
                : 0;
    }

    public setPeriod(period: number) {
        this.paulaNode.parameters.get("period")!.value =
            period *
            (this.current_instrument === null
                ? 1
                : Math.pow(2, this.current_instrument.finetune / 12 / 8)
            );
    }

    public tick_effect() {
        if (this.volume_slide !== 0) {
            this.gainNode.gain.value += this.volume_slide;
            if (this.gainNode.gain.value > 1) {
                this.gainNode.gain.value = 1;
                this.volume_slide = 0;
            } else if (this.gainNode.gain.value < 0) {
                this.gainNode.gain.value = 0;
                this.volume_slide = 0;
            }
        }
    }
}

const effect_names = [
    "0 - Normal play or Arpeggio             0xy : x-first halfnote add, y-second",
    "1 - Slide Up                            1xx : upspeed",
    "2 - Slide Down                          2xx : downspeed",
    "3 - Tone Portamento                     3xx : up/down speed",
    "4 - Vibrato                             4xy : x-speed,   y-depth",
    "5 - Tone Portamento + Volume Slide      5xy : x-upspeed, y-downspeed",
    "6 - Vibrato + Volume Slide              6xy : x-upspeed, y-downspeed",
    "7 - Tremolo                             7xy : x-speed,   y-depth",
    "",
    "9 - Set SampleOffset                    9xx : offset (23 -> 2300)",
    "A - VolumeSlide                         Axy : x-upspeed, y-downspeed",
    "B - Position Jump                       Bxx : songposition",
    "C - Set Volume                          Cxx : volume, 00-40",
    "D - Pattern Break                       Dxx : break position in next patt",
    "E9- Retrig Note                         E9x : retrig from note + x vblanks",
    "F - Set Speed___________________________Fxx : speed (00-1F) / tempo (20-FF)",
];

(async function () {
    const mod = await read_mod();

    const btn = document.createElement("button");
    btn.innerText = "Play";
    document.body.append(btn);

    btn.onclick = async () => {
        const audio_ctx = new AudioContext({ sampleRate: 28867 * 2 });
        const gain = audio_ctx.createGain();
        gain.connect(audio_ctx.destination);
        gain.gain.value = 0.1;

        await audio_ctx.audioWorklet.addModule("dist/paula_processor.js");

        const channels = [
            new Channel(gain),
            new Channel(gain),
            new Channel(gain),
            new Channel(gain),
        ];

        let song_position = 0;
        let pattern_position = 0;
        let ticks = 0;
        let last_time = 0;
        let ms_accum = 0;
        let ticks_per_row = 7;

        (function render(time: number) {
            const dt = (time - last_time);
            last_time = time;

            ms_accum += dt;
            while (ms_accum >= 20) {
                ms_accum -= 20;

                ticks++;

                for (const channel of channels) {
                    channel.tick_effect();
                }

                if (ticks === ticks_per_row) {
                    ticks = 0;
                    const pattern_number = mod.song_positions[song_position];
                    const pattern_rows = mod.patterns[pattern_number];
                    const row = pattern_rows[pattern_position];

                    for (let i = 0; i < 4; i++) {
                        const channel = channels[i];


                        const ch_note = row[i];
                        if (ch_note.sample_number > 0) {
                            const instrument =
                                mod.instruments_with_samples[ch_note.sample_number - 1];
                            channel.setInstrument(instrument);
                            channel.setVolume(instrument.volume / 64);
                        }

                        if (ch_note.period > 0) {
                            channel.setPeriod(ch_note.period);
                        }

                        if (ch_note.effect > 0) {
                            console.log("Effect", effect_names[ch_note.effect]);

                            if (ch_note.effect === 0x0C) {
                                channel.setVolume(ch_note.effect_xy / 64);
                            } else if (ch_note.effect === 0x0F) {
                                ticks_per_row = ch_note.effect_xy;
                            } else if (ch_note.effect === 0x0A) {
                                channel.volume_slide = (ch_note.effect_xy >= 0xF0 ? ch_note.effect_xy >> 4 : -ch_note.effect_xy) / 64;
                            } else {
                                // throw new Error("Unimplemented effect " + ch_note.effect.toString(16));
                            }
                        }
                    }

                    pattern_position++;
                    if (pattern_position >= 64) {
                        pattern_position = 0;
                        song_position++;
                    }
                }
            }


            requestAnimationFrame(render);
        })(0);
    };
})();
