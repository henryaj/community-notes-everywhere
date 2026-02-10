class Page < ApplicationRecord
  has_many :notes, dependent: :destroy

  validates :url, presence: true, uniqueness: true

  before_validation :normalize_url, :extract_domain

  def self.find_or_create_for_url(raw_url)
    normalized = normalize_url_string(raw_url)
    find_or_create_by!(url: normalized)
  end

  def self.normalize_url_string(raw_url)
    uri = URI.parse(raw_url.strip)
    uri.fragment = nil
    uri.path = uri.path.chomp("/") if uri.path != "/"
    uri.to_s
  rescue URI::InvalidURIError
    raw_url.strip
  end

  private

  def normalize_url
    self.url = self.class.normalize_url_string(url) if url.present?
  end

  def extract_domain
    self.domain = URI.parse(url).host if url.present?
  rescue URI::InvalidURIError
    # leave domain nil
  end
end
