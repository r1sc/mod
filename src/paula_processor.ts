type Msg = { kind: "sample_data"; sample_data: Float32Array };

class PaulaProcessor extends AudioWorkletProcessor implements AudioWorkletProcessorImpl {
  position = 0;
  sample_data: Float32Array | null = null;
  wrapped_around = false;

  constructor() {
    super();

    this.port.onmessage = (e) => {
      const msg = e.data as Msg;
      if (msg.kind === "sample_data") {
        this.sample_data = msg.sample_data;
        this.position = 0;
        this.wrapped_around = false;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      { name: "period", defaultValue: 0, },
      { name: "loopStart", defaultValue: 0, },
      { name: "loopEnd", defaultValue: 0, },
    ];
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.sample_data) return true;

    const loop_start = parameters["loopStart"][0];
    let loop_end = parameters["loopEnd"][0];
    const period = parameters["period"][0];

    const is_one_shot = loop_end === 0;
    if (is_one_shot) {
      loop_end = this.sample_data.length;
    }

    const channel = outputs[0][0];

    for (let i = 0; i < channel.length; i++) {
      channel[i] =
        is_one_shot && this.wrapped_around
          ? 0
          : this.sample_data[this.position | 0];

      if (period > 0) {
        this.position += 62 / period;

        if (this.position > loop_end) {
          const overflow = this.position - loop_end;
          this.position = loop_start + overflow;
          this.wrapped_around = true;
        }
      }
    }

    return true;
  }
}

registerProcessor("paula_processor", PaulaProcessor);
