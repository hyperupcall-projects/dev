import { Octokit, App } from "octokit";

export const octokit = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });
