import dedent from 'dedent'
import { writeTrees } from '../util/util.js'
import { execa } from 'execa'

/**
 * @typedef Options
 * @property {string} projectName
 * @property {string} projectVariant
 *
 * @param {Options} opts
 */
export async function initRust(opts) {
	if (opts.projectVariant === 'hello-world') {
		await initHelloWorld(opts)
	} else if (opts.projectVariant === 'cli') {
		await initCli(opts)
	} else if (opts.projectVariant === 'gui') {
		await initGui(opts)
	}
}

export async function runRust() {
	await execa('cargo', ['run'], {
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	})
}

/**
 * @param {Options} opts
 */
async function initHelloWorld(opts) {
	const packageName = 'hello-world'

	await writeTrees([
		boilerplateTree(opts),
		{
			'./src/main.rs': dedent`
			fn main() {
				println!("Hello, world!");
			}
			`,
		},
	])
}

/**
 * @param {Options} opts
 */
async function initCli(opts) {
	await writeTrees([
		boilerplateTree(opts),
		{
			'./src/cli.rs': dedent`
			use std::str;

			use clap::{Parser, Subcommand};

			#[derive(Parser, Debug)]
			#[command(author, version, about, long_about = None)]
			pub struct Args {
				#[command(subcommand)]
				pub action: Action,

				/// Whether or not to show the GUI
				#[arg(long, default_value_t = false)]
				pub gui: bool,
			}

			#[derive(Subcommand, Debug)]
			pub enum Action {
				Launch { category: String },
				Set { category: String, choice: String },
				Get { category: String },
				List { category: Option<String> },
				Install { category: String, choice: String },
				Uninstall { category: String, choice: String },
				Test { category: String, choice: String },
			}
			`,
			'./src/main.rs': dedent`
			use std::{fs, path::PathBuf, process::exit};

			use clap::Parser;
			use cli::{Action, Args};

			mod cli;
			mod config;
			mod util;

			// EXECUTION PROVIDER
			// rust "inline exec"
			// shell script combo (putting together every application of a category in a single shell script to save space / times)
			// shell script
			// desktop file

			fn main() {
				let cli = Args::parse();
				let mut data = util::get_data();
				// let cfg = config::config().unwrap();

				match cli.action {
					Action::Launch { category } => {
						let chosen = util::get_default_choice(&category);
						util::run(&category, chosen.as_str(), "launch");
					}
					Action::Set { category, choice } => {
						util::assert_category(&category);
						util::assert_choice(&category, &choice);
						data.categories.categories.insert(category, choice);
						util::save_data(&data);
					}
					Action::Get { category } => {
						util::assert_category(&category);
						let key = data.categories.categories.get(&category).unwrap();
						println!("{}", key);
					}
					Action::List { category } => {
						let list = |dir: PathBuf| {
							for entry in fs::read_dir(&dir)
								.expect(format!("Directory does not exist: {}", dir.to_str().unwrap()).as_str())
							{
								let path = entry.unwrap().path();
								let basename = path.file_name().unwrap();

								let s = String::from(basename.to_str().unwrap());
								let s = s.strip_suffix(".sh").unwrap_or(&s);
								println!("{}", s);
							}
						};

						let choose_dir = util::get_main_dir();
						if let Some(category) = category {
							let dir = choose_dir.join("categories").join(category);
							list(dir);
						} else {
							let dir = choose_dir.join("categories");
							list(dir);
						}
					}
					Action::Install { category, choice } => {
						util::run(&category, &choice, "install");
					}
					Action::Uninstall { category, choice } => {
						util::run(&category, &choice, "uninstall");
					}
					Action::Test { category, choice } => {
						util::run(&category, &choice, "test");
					}
				}
			}
			`,
		},
	])
}

/**
 * @param {Options} opts
 */
async function initGui(opts) {
	await writeTrees([boilerplateTree(opts), {}])
}

/**
 * @param {Options} opts
 */
function boilerplateTree(opts) {
	return {
		'Cargo.toml': cargoToml(opts.projectName),
		'rustfmt.toml': rustFmtToml(),
		rustToolchainToml: rustToolchainToml(),
		'.editorconfig': editorConfig(),
	}
}

/**
 * @param {string} packageName
 */
function cargoToml(packageName) {
	return dedent`
		[package]
		name = "${packageName}"
		version = "0.1.0"
		edition = "2021"
		`
}

function rustFmtToml() {
	return dedent`
		hard_tabs = true
		tab_spaces = 3
		`
}

function rustToolchainToml() {
	return dedent`
		[toolchain]
		channel = "stable"
		`
}

function editorConfig() {
	return dedent`
		root = true

		[*]
		indent_style = tab
		end_of_line = lf
		charset = utf-8
		trim_trailing_whitespace = true
		insert_final_newline = true

		[*.{md,yaml,yml}]
		indent_style = space
		indent_size = 2
		`
}
