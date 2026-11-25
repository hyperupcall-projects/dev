use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{self, ErrorKind};
use std::os::unix::ffi::OsStringExt;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::process::{self, Command, Stdio};

pub fn backup_path() -> io::Result<PathBuf> {
	// Let Git resolve linked worktrees and GIT_DIR overrides.
	let output = Command::new("git")
		.args(["rev-parse", "--git-path", "FAILED_COMMIT_MSG"])
		.stderr(Stdio::inherit())
		.output()?;
	let mut path = output.stdout;
	if !output.status.success() || path.pop() != Some(b'\n') || path.is_empty() {
		return Err(io::Error::other(
			"cannot locate FAILED_COMMIT_MSG using git rev-parse",
		));
	}
	Ok(PathBuf::from(OsString::from_vec(path)))
}

// Publish only a complete copy. Return false only when the source is missing.
pub fn copy_message(source: &Path, destination: &Path) -> io::Result<bool> {
	let mut input = match File::open(source) {
		Ok(file) => file,
		Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
		Err(error) => return Err(error),
	};
	for attempt in 0..128 {
		let mut name = destination.as_os_str().to_os_string();
		name.push(format!(".{}.{attempt}.tmp", process::id()));
		let temporary = PathBuf::from(name);
		let mut output = match OpenOptions::new()
			.write(true)
			.create_new(true)
			.mode(0o600)
			.open(&temporary)
		{
			Ok(file) => file,
			Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
			Err(error) => return Err(error),
		};
		let result = (|| {
			io::copy(&mut input, &mut output)?;
			output.sync_all()?;
			drop(output);
			fs::rename(&temporary, destination)?;
			Ok(true)
		})();
		if result.is_err() {
			let _ = fs::remove_file(&temporary);
		}
		return result;
	}
	Err(io::Error::new(
		ErrorKind::AlreadyExists,
		"cannot create temporary message file",
	))
}

pub fn remove_backup(path: &Path) -> io::Result<()> {
	match fs::remove_file(path) {
		Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
		result => result,
	}
}
