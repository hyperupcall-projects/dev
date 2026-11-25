mod commit_message;

use std::env;
use std::io;
use std::path::Path;
use std::process;

fn run() -> io::Result<i32> {
	let args: Vec<_> = env::args_os().collect();
	if !(2..=4).contains(&args.len()) {
		eprintln!("Usage: prepare-commit-msg MESSAGE_FILE [SOURCE [SHA]]");
		return Ok(2);
	}
	// A regular commit can have source 'template' when commit.template is set.
	// Preserve explicit messages, amended commits, merges, and squashes.
	if let Some(source) = args.get(2) {
		if !source.is_empty() && source != "template" {
			return Ok(0);
		}
	}
	let backup = commit_message::backup_path()?;
	if commit_message::copy_message(&backup, Path::new(&args[1]))? {
		commit_message::remove_backup(&backup)?;
	}
	Ok(0)
}

fn main() {
	process::exit(match run() {
		Ok(code) => code,
		Err(error) => {
			eprintln!("prepare-commit-msg: {error}");
			1
		}
	});
}
