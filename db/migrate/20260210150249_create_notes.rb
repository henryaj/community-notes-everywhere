class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes do |t|
      t.text :body, null: false
      t.references :author, null: false, foreign_key: { to_table: :users }
      t.references :page, null: false, foreign_key: true
      t.text :selected_text, null: false
      t.string :text_prefix
      t.string :text_suffix
      t.string :css_selector
      t.integer :status, default: 0, null: false
      t.integer :helpful_count, default: 0, null: false
      t.integer :not_helpful_count, default: 0, null: false

      t.timestamps
    end
  end
end
