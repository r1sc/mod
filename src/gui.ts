import { Pattern } from "./mod_parser";

export function start_gui() {
	let current_pattern: Pattern | null = null;
	let current_row = 0;

	const update_state = (pattern: Pattern, row: number) => {
		current_pattern = pattern;
		current_row = row;
	};

	const canvas = document.createElement("canvas");
	document.body.append(canvas);

	const ctx = canvas.getContext("2d")!;

	const render = () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (current_pattern) {
			for (let r = 0; r < current_pattern.length; r++) {
				const row = current_pattern[r];
				for (let channel = 0; channel < 4; channel++) {
					const cell = row[channel];
					ctx.fillText(
						cell.period.toString(),
						channel * 20,
						(r - current_row) * 10
					);
				}
			}
		}

		requestAnimationFrame(render);
	};
	render();

	return { update_state };
}
