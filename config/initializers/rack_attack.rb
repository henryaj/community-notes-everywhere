class Rack::Attack
  # Throttle GET requests: 60 req/min per IP
  throttle("req/ip/get", limit: 60, period: 1.minute) do |req|
    req.ip if req.get?
  end

  # Throttle write requests: 10 req/min per IP
  throttle("req/ip/write", limit: 10, period: 1.minute) do |req|
    req.ip if req.post? || req.patch? || req.put? || req.delete?
  end

  self.throttled_responder = lambda do |_request|
    [ 429, { "Content-Type" => "application/json" }, [ { error: "Rate limit exceeded. Try again later." }.to_json ] ]
  end
end
