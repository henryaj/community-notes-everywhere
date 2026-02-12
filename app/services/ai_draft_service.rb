class AiDraftService
  MAX_SELECTED_TEXT_LENGTH = 2000
  DEFAULT_MODEL = "gemini-3-flash-preview"
  MAX_TOKENS = 4096

  SYSTEM_PROMPT = <<~PROMPT
    You are a community note writer. Your job is to provide brief, factual context for claims made online.

    Guidelines:
    - Be factual, neutral, and encyclopedic in tone
    - Write 2-4 sentences
    - Provide important context that readers across different viewpoints would find useful
    - Do not express opinions or take sides
    - Do not be inflammatory or sarcastic
    - Focus on verifiable facts
    - Do NOT include source URLs or links — the user will add their own sources
  PROMPT

  def initialize(selected_text:, page_url:, surrounding_text: nil)
    @selected_text = selected_text.to_s.truncate(MAX_SELECTED_TEXT_LENGTH)
    @page_url = page_url
    @surrounding_text = surrounding_text
  end

  def generate
    client = Gemini.new(
      credentials: {
        service: "generative-language-api",
        api_key: ENV.fetch("GOOGLE_API_KEY"),
        version: "v1beta"
      },
      options: { model: DEFAULT_MODEL, server_sent_events: false }
    )

    user_message = build_user_message

    response = client.generate_content(
      {
        contents: { role: "user", parts: { text: user_message } },
        system_instruction: { parts: { text: SYSTEM_PROMPT } },
        generation_config: { max_output_tokens: MAX_TOKENS }
      }
    )

    body = response.dig("candidates", 0, "content", "parts", 0, "text")
    raise "No text in Gemini response" if body.blank?

    { body: body, model: DEFAULT_MODEL }
  rescue => e
    Rails.logger.error("AiDraftService error: #{e.message}")
    { error: e.message }
  end

  private

  def build_user_message
    parts = []
    parts << "Page URL: #{@page_url}"
    parts << "Selected text: \"#{@selected_text}\""
    parts << "Surrounding context: \"#{@surrounding_text}\"" if @surrounding_text.present?
    parts << ""
    parts << "Write a community note providing factual context for the selected text. Do not include any URLs or links."
    parts.join("\n")
  end
end
