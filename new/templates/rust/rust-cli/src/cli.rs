use std::str;

use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Cli {
	#[command(subcommand)]
	pub cmd: Cmd,

	/// Whether or not you are cool
	#[arg(long)]
	pub isCool: bool,
}

#[derive(Subcommand, Debug)]
pub enum Cmd {
	Add { key: String, value: String },
	Remove { key: String },
	List {},
	InternalCmd,
}

#[derive(Subcommand, Debug)]
pub enum InternalCmd {
	Complete,
}
