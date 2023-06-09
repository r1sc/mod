import { read_mod } from "./mod_parser";

console.clear();

type Instrument = { repeat_point: number, repeat_length: number, sample_data: Float32Array };

class Channel {
    private gainNode: GainNode;
    private paulaNode: AudioWorkletNode;
    private current_instrument: Instrument | null = null;

    constructor(private ctx: AudioContext) {
        this.gainNode = ctx.createGain();
        this.gainNode.connect(ctx.destination);

        this.paulaNode = new AudioWorkletNode(ctx, "paula_processor");
        this.paulaNode.connect(this.gainNode);
    }

    public setVolume(factor: number) {
        this.gainNode.gain.value = factor;
    }

    public setInstrument(instrument: Instrument) {
        if (this.current_instrument === instrument) return;

        this.paulaNode.port.postMessage({ kind: "sample_data", sample_data: instrument.sample_data });
        this.paulaNode.parameters.get("loopStart")!.value = instrument.repeat_point;
        this.paulaNode.parameters.get("loopEnd")!.value = instrument.repeat_length > 2
            ? instrument.repeat_point + instrument.repeat_length
            : instrument.sample_data.length;
    }

    public setPeriod(period: number) {
        this.paulaNode.parameters.get("period")!.value = period;
    }
}

(async function () {
    const mod = await read_mod();

    const btn = document.createElement("button");
    btn.innerText = "Play";
    document.body.append(btn);
    btn.onclick = async () => {
        const audio_ctx = new AudioContext({ sampleRate: 28867 });

        await audio_ctx.audioWorklet.addModule("dist/paula_processor.js");

        const channels = [
            new Channel(audio_ctx),
            new Channel(audio_ctx),
            new Channel(audio_ctx),
            new Channel(audio_ctx)
        ];
        channels.forEach(channel => channel.setVolume(0.5));

        let song_position = 0;
        let pattern_position = 0;

        setInterval(function() {
            const pattern_number = mod.song_positions[song_position];
            const pattern_rows = mod.patterns[pattern_number];
            const row = pattern_rows[pattern_position];

            for (let i = 0; i < 4; i++) {
                const channel = channels[i];
                const ch_note = row[i];
                if (ch_note.sample_number > 0) {
                    const instrument = mod.instruments_with_samples[ch_note.sample_number - 1];
                    channel.setInstrument(instrument);
                }

                if (ch_note.period >= 124) {
                    channel.setPeriod(ch_note.period);
                }                
            }

            pattern_position++;
            if (pattern_position >= 64) {
                pattern_position = 0;
                song_position++;
            }

        }, 20 * 6);
    };
})();