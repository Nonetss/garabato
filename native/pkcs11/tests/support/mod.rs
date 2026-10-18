//! A one-shot HTTP server on loopback that answers canned responses and
//! records the requests, to test the client without Garabato.

use std::{
    io::{BufRead, BufReader, Read, Write},
    net::TcpListener,
    sync::{Arc, Mutex},
    thread,
};

#[derive(Debug, Clone)]
pub struct Request {
    pub method: String,
    pub path: String,
    pub api_key: Option<String>,
    pub body: String,
}

pub struct Stub {
    pub url: String,
    pub requests: Arc<Mutex<Vec<Request>>>,
}

/// Serves `responses` in order, one per connection, as `(status, json body)`.
pub fn serve(responses: Vec<(u16, &'static str)>) -> Stub {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let recorded = requests.clone();
    thread::spawn(move || {
        for (status, body) in responses {
            let Ok((stream, _)) = listener.accept() else { return };
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            let mut parts = line.split_whitespace();
            let method = parts.next().unwrap_or_default().to_string();
            let path = parts.next().unwrap_or_default().to_string();
            let mut api_key = None;
            let mut length = 0;
            loop {
                let mut header = String::new();
                reader.read_line(&mut header).unwrap();
                let header = header.trim_end();
                if header.is_empty() {
                    break;
                }
                let (name, value) = header.split_once(':').unwrap_or((header, ""));
                match name.to_ascii_lowercase().as_str() {
                    "x-api-key" => api_key = Some(value.trim().to_string()),
                    "content-length" => length = value.trim().parse().unwrap_or(0),
                    _ => {}
                }
            }
            let mut content = vec![0; length];
            reader.read_exact(&mut content).unwrap();
            recorded.lock().unwrap().push(Request {
                method,
                path,
                api_key,
                body: String::from_utf8_lossy(&content).into_owned(),
            });
            let mut stream = stream;
            let _ = write!(
                stream,
                "HTTP/1.1 {status} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    });
    Stub { url, requests }
}
