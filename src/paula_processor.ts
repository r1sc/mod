type Msg = { kind: "sample_data", sample_data: Float32Array };

class PaulaProcessor extends AudioWorkletProcessor implements AudioWorkletProcessorImpl {
  position = 0;
  sample_data: Float32Array | null = null;

  constructor() {
    super();

    this.port.onmessage = (e) => {
      const msg = e.data as Msg;
      if (msg.kind === "sample_data") {
        this.sample_data = msg.sample_data;
        this.position = 0;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      {
        name: "period",
        defaultValue: 0
      },
      {
        name: "loopStart",
        defaultValue: 0
      },
      {
        name: "loopEnd",
        defaultValue: 0
      }
    ];
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.sample_data) return true;

    const loop_start = parameters["loopStart"][0];
    const loop_end = parameters["loopEnd"][0] - 1;
    const period = parameters["period"][0];

    const channel = outputs[0][0];

    for (let i = 0; i < channel.length; i++) {

      channel[i] = this.sample_data[this.position | 0];

      if (period > 0) {

        this.position += (124 / period);

        if (this.position > loop_end) {
          const overflow = this.position - loop_end;
          this.position = loop_start + overflow;
        }
      }

    }

    return true;
  }

}

registerProcessor("paula_processor", PaulaProcessor);